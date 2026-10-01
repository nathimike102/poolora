/**
 * AdminUserService.ts
 *
 * Account management (UC-A05) and driver applications (UC-A01) for the web
 * admin. Every change is written to the audit log and, where it affects the
 * user, sent to them as a notification.
 */

import { Types } from 'mongoose';
import { User } from '../models/User';
import { Booking } from '../models/Booking';
import { Ride } from '../models/Ride';
import { Rating } from '../models/Rating';
import { Payment } from '../models/Payment';
import { Dispute } from '../models/Dispute';
import { EmergencyRecord } from '../models/EmergencyRecord';
import { AdminNote } from '../models/AdminNote';
import { AdminAuditLog } from '../models/AdminAuditLog';
import { FraudLevel, KYCStatus } from '../types';
import { AppError, NotFoundError } from '../utils/AppError';
import { audit } from './AuditService';
import { NotificationService } from './NotificationService';
import { emailUser } from './Mailer';
import { FRAUD_SUSPENSION_PREFIX } from './FraudDetectionService';

/** Suspensions come in fixed lengths; null is until an admin lifts it (UC-A05). */
export const SUSPENSION_DAYS = [7, 15, 30, null] as const;

/** Fields never sent to the admin UI. */
const PRIVATE_FIELDS = '-otpAttempts -otpLastAttemptAt -fcmTokens';

/** KYC documents an admin can ask a driver to upload again. */
export const KYC_DOCUMENTS = ['licence', 'registration', 'insurance', 'photo'] as const;
const DOCUMENT_LABELS: Record<(typeof KYC_DOCUMENTS)[number], string> = {
  licence: 'driving licence',
  registration: 'vehicle registration',
  insurance: 'insurance',
  photo: 'profile photo',
};

function requireReason(reason: unknown): string {
  const text = typeof reason === 'string' ? reason.trim() : '';
  if (text.length < 5) throw new AppError('Give a reason of at least a few words', 422, 'VALIDATION_ERROR');
  return text;
}

async function tell(userId: string, title: string, message: string): Promise<void> {
  const notifications = new NotificationService();
  await Promise.allSettled([
    notifications.createNotification(userId, title, message, 'system'),
    notifications.sendPushNotification(userId, title, message, { type: 'account' }),
    emailUser(userId, title, message),
  ]);
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class AdminUserService {
  /** Search by name, phone or email, with optional filters. */
  async search(params: { q?: string; role?: string; status?: string; kycStatus?: string; page: number; limit: number }) {
    const filter: Record<string, unknown> = {};
    if (params.q?.trim()) {
      const re = new RegExp(escapeRegex(params.q.trim()), 'i');
      filter.$or = [{ name: re }, { phone: re }, { email: re }];
    }
    if (params.role) filter.capabilities = params.role;
    if (params.kycStatus) filter['kyc.status'] = params.kycStatus;
    if (params.status === 'blocked') filter.isBlocked = true;
    else if (params.status === 'suspended') Object.assign(filter, { isSuspended: true, isBlocked: { $ne: true } });
    else if (params.status === 'pending_block') filter['pendingBlock.requestedAt'] = { $exists: true };
    else if (params.status === 'active') Object.assign(filter, { isSuspended: { $ne: true }, isBlocked: { $ne: true } });

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('name phone email capabilities gender kyc.status stats isSuspended suspendedUntil isBlocked warnings fraudLevel pendingBlock createdAt')
        .sort({ createdAt: -1 })
        .skip((params.page - 1) * params.limit)
        .limit(params.limit)
        .lean(),
      User.countDocuments(filter),
    ]);
    return { users, total, page: params.page, limit: params.limit };
  }

  /** Everything an admin needs to judge an account (UC-A05 step 2). */
  async detail(userId: string) {
    const user = await User.findById(userId).select(`${PRIVATE_FIELDS} +safetyRating`).populate('pendingBlock.requestedBy', 'name email').lean();
    if (!user) throw new NotFoundError('User');
    const id = new Types.ObjectId(userId);
    const [bookingsAsRider, ridesAsDriver, ratings, payments, disputes, sos, notes, auditLog] = await Promise.all([
      Booking.find({ rider: id })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('ride', 'pickup.address dropoff.address departureTime status')
        .populate('driver', 'name')
        .lean(),
      Ride.find({ driver: id })
        .select('pickup.address dropoff.address departureTime status totalSeats availableSeats pricePerSeat cancellationReason')
        .sort({ departureTime: -1 })
        .limit(20)
        .lean(),
      Rating.find({ ratee: id }).sort({ createdAt: -1 }).limit(20).populate('rater', 'name').lean(),
      Payment.find({ $or: [{ rider: id }, { driver: id }] }).sort({ createdAt: -1 }).limit(20).lean(),
      Dispute.find({ $or: [{ raisedBy: id }, { against: id }] }).sort({ createdAt: -1 }).limit(20).lean(),
      EmergencyRecord.find({ triggeredBy: id }).select('status riskLevel createdAt').sort({ createdAt: -1 }).limit(10).lean(),
      AdminNote.find({ user: id }).sort({ createdAt: -1 }).populate('author', 'name email').lean(),
      AdminAuditLog.find({ targetId: userId }).sort({ createdAt: -1 }).limit(50).populate('actor', 'name email').lean(),
    ]);
    const cancelledAsRider = bookingsAsRider.filter((b) => b.status === 'cancelled' && b.cancelledBy?.toString() === userId).length;
    return { user, bookingsAsRider, ridesAsDriver, ratings, payments, disputes, sos, notes, auditLog, cancelledAsRider };
  }

  async suspend(userId: string, adminId: string, days: number | null, reason: unknown) {
    const why = requireReason(reason);
    if (!SUSPENSION_DAYS.includes(days as (typeof SUSPENSION_DAYS)[number])) {
      throw new AppError('Suspend for 7, 15 or 30 days, or until lifted', 422, 'VALIDATION_ERROR');
    }
    if (userId === adminId) throw new AppError('You cannot suspend your own account', 409, 'CONFLICT');
    const until = days ? new Date(Date.now() + days * 86_400_000) : undefined;
    const user = await User.findByIdAndUpdate(
      userId,
      until
        ? { $set: { isSuspended: true, suspendedUntil: until, suspensionReason: why } }
        : { $set: { isSuspended: true, suspensionReason: why }, $unset: { suspendedUntil: 1 } },
      { new: true },
    );
    if (!user) throw new NotFoundError('User');
    await audit(adminId, 'user.suspend', 'user', userId, why, { days });
    await tell(
      userId,
      'Account suspended',
      `Your account is suspended${until ? ` until ${until.toDateString()}` : ''}: ${why}. You can still see your rides but cannot post or book. You can appeal within 30 days from Help > Appeal a decision.`,
    );
    return user;
  }

  async reinstate(userId: string, adminId: string, reason: unknown) {
    const why = requireReason(reason);
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { isSuspended: false }, $unset: { suspendedUntil: 1, suspensionReason: 1 } },
      { new: true },
    );
    if (!user) throw new NotFoundError('User');
    await audit(adminId, 'user.reinstate', 'user', userId, why);
    await tell(userId, 'Account reinstated', 'Your suspension has been lifted. You can post and book rides again.');
    return user;
  }

  /** A permanent block needs a second admin to approve it (UC-A05 3b). */
  async requestBlock(userId: string, adminId: string, reason: unknown) {
    const why = requireReason(reason);
    if (userId === adminId) throw new AppError('You cannot block your own account', 409, 'CONFLICT');
    const user = await User.findOneAndUpdate(
      { _id: userId, isBlocked: { $ne: true } },
      { $set: { pendingBlock: { requestedBy: new Types.ObjectId(adminId), reason: why, requestedAt: new Date() } } },
      { new: true },
    );
    if (!user) throw new AppError('This account does not exist or is already blocked', 409, 'CONFLICT');
    await audit(adminId, 'user.block.request', 'user', userId, why);
    return user;
  }

  async approveBlock(userId: string, adminId: string) {
    const user = await User.findById(userId);
    if (!user?.pendingBlock?.requestedAt) throw new AppError('No block is waiting for approval', 409, 'CONFLICT');
    if (user.pendingBlock.requestedBy.toString() === adminId) {
      throw new AppError('A different admin must approve a block you asked for', 403, 'SECOND_ADMIN_REQUIRED');
    }
    const reason = user.pendingBlock.reason;
    user.isBlocked = true;
    user.blockReason = reason;
    user.pendingBlock = undefined;
    await user.save();
    await audit(adminId, 'user.block.approve', 'user', userId, reason);
    return user;
  }

  async rejectBlock(userId: string, adminId: string, reason: unknown) {
    const why = requireReason(reason);
    const user = await User.findOneAndUpdate(
      { _id: userId, 'pendingBlock.requestedAt': { $exists: true } },
      { $unset: { pendingBlock: 1 } },
      { new: true },
    );
    if (!user) throw new AppError('No block is waiting for approval', 409, 'CONFLICT');
    await audit(adminId, 'user.block.reject', 'user', userId, why);
    return user;
  }

  async unblock(userId: string, adminId: string, reason: unknown) {
    const why = requireReason(reason);
    const user = await User.findOneAndUpdate(
      { _id: userId, isBlocked: true },
      { $set: { isBlocked: false }, $unset: { blockReason: 1 } },
      { new: true },
    );
    if (!user) throw new AppError('This account is not blocked', 409, 'CONFLICT');
    await audit(adminId, 'user.unblock', 'user', userId, why);
    return user;
  }

  async addNote(userId: string, adminId: string, text: unknown) {
    const body = typeof text === 'string' ? text.trim() : '';
    if (!body) throw new AppError('The note is empty', 422, 'VALIDATION_ERROR');
    if (!(await User.exists({ _id: userId }))) throw new NotFoundError('User');
    const note = await AdminNote.create({ user: userId, author: adminId, text: body.slice(0, 2000) });
    await audit(adminId, 'user.note', 'user', userId, undefined, { noteId: note._id.toString() });
    return note.populate('author', 'name email');
  }

  /** Pending driver applications with risk indicators (UC-A01 step 2). */
  async applications(status: string = KYCStatus.PENDING): Promise<Array<Record<string, unknown>>> {
    const users = await User.find({ 'kyc.status': status })
      .select('name phone email gender kyc vehicles stats fraudLevel warnings isSuspended createdAt')
      .sort({ 'kyc.submittedAt': 1 })
      .limit(200)
      .lean();
    const now = Date.now();
    return users.map((u) => {
      const vehicle = u.vehicles?.[u.vehicles.length - 1];
      const risks: string[] = [];
      if (u.fraudLevel && u.fraudLevel !== FraudLevel.CLEAR) risks.push(`Fraud check: ${u.fraudLevel}`);
      if (now - new Date(u.createdAt).getTime() < 7 * 86_400_000) risks.push('Account under a week old');
      if ((u.stats?.cancellationRate ?? 0) > 0.2) risks.push('Cancels often');
      if ((u.warnings ?? 0) > 0) risks.push(`${u.warnings} warning${u.warnings === 1 ? '' : 's'}`);
      if (vehicle?.year && new Date().getFullYear() - vehicle.year >= 15) risks.push('Vehicle 15 or more years old');
      if (!u.kyc?.drivingLicenseUrl) risks.push('No driving licence uploaded');
      if (!vehicle?.registrationDocUrl) risks.push('No registration uploaded');
      if (!vehicle?.insuranceDocUrl) risks.push('No insurance uploaded');
      for (const c of u.kyc?.autoChecks ?? []) if (c.result === 'fail') risks.push(`${c.check}: ${c.detail}`);
      if (u.kyc?.backgroundCheck?.status === 'consider') risks.push('Background check needs a look');
      const waitingHours = u.kyc?.submittedAt ? (now - new Date(u.kyc.submittedAt).getTime()) / 3_600_000 : 0;
      return {
        ...u,
        documents: {
          licence: Boolean(u.kyc?.drivingLicenseUrl),
          registration: Boolean(vehicle?.registrationDocUrl),
          insurance: Boolean(vehicle?.insuranceDocUrl),
        },
        risks,
        overdue: waitingHours > 48, // applications are reviewed within 48 hours
      };
    });
  }

  /** Ask the driver to upload some documents again (UC-A01 step 6c). */
  async requestKycChanges(userId: string, adminId: string, documents: unknown, note: unknown) {
    const docs = Array.isArray(documents) ? documents.filter((d): d is (typeof KYC_DOCUMENTS)[number] => KYC_DOCUMENTS.includes(d)) : [];
    if (docs.length === 0) throw new AppError('Pick at least one document to re-upload', 422, 'VALIDATION_ERROR');
    const why = requireReason(note);
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('User');
    if (user.kyc.status !== KYCStatus.PENDING) throw new AppError('This application is not waiting for review', 409, 'CONFLICT');
    const list = docs.map((d) => DOCUMENT_LABELS[d]).join(', ');
    // A rejected application can be resubmitted from the app, with the reason shown
    user.kyc.status = KYCStatus.REJECTED;
    user.kyc.reviewedAt = new Date();
    user.kyc.rejectionReason = `Please upload again: ${list}. ${why}`;
    await user.save();
    await audit(adminId, 'kyc.request_changes', 'kyc', userId, why, { documents: docs });
    await tell(userId, 'Driver application: documents needed', `Please upload your ${list} again. ${why}`);
    return user;
  }

  /**
   * Accounts the fraud check flagged (UC-AI02). `open` lists those waiting
   * for a decision, oldest first, since high-risk flags are due within 2 hours;
   * `reviewed` lists recent decisions, which double as labels for retraining.
   */
  async fraudQueue(view: 'open' | 'reviewed' = 'open'): Promise<{ accounts: Array<Record<string, unknown>> }> {
    const flagged = { fraudLevel: { $in: [FraudLevel.FLAGGED, FraudLevel.BLOCKED] } };
    const filter = view === 'open'
      ? { ...flagged, fraudReview: { $exists: false } }
      : { fraudReview: { $exists: true } };
    const accounts = await User.find(filter)
      .select('name phone email capabilities fraudLevel fraudFlags fraudFlaggedAt fraudReview isSuspended suspensionReason isBlocked stats warnings createdAt')
      .populate('fraudReview.by', 'name')
      .sort(view === 'open' ? { fraudFlaggedAt: 1 } : { 'fraudReview.at': -1 })
      .limit(200)
      .lean();
    const dueMs = 2 * 3_600_000;
    return {
      accounts: accounts.map((u) => ({
        ...u,
        overdue: view === 'open' && Boolean(u.fraudFlaggedAt) && Date.now() - new Date(u.fraudFlaggedAt as Date).getTime() > dueMs,
      })),
    };
  }

  /**
   * An admin's decision on a fraud flag. Clearing it is a false positive:
   * the flag goes and a suspension the check placed is lifted. Confirming
   * keeps the account as it is; blocking it still takes two admins.
   */
  async reviewFraud(userId: string, adminId: string, decision: unknown, note: unknown) {
    if (decision !== 'cleared' && decision !== 'confirmed') {
      throw new AppError('Decision must be cleared or confirmed', 422, 'VALIDATION_ERROR');
    }
    const why = requireReason(note);
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('User');
    if (user.fraudLevel === FraudLevel.CLEAR) throw new AppError('This account has no fraud flag', 409, 'CONFLICT');
    if (user.fraudReview) throw new AppError('This flag has already been reviewed', 409, 'CONFLICT');

    const review = { decision, by: new Types.ObjectId(adminId), at: new Date(), note: why };
    const liftSuspension = decision === 'cleared' && user.isSuspended && (user.suspensionReason ?? '').startsWith(FRAUD_SUSPENSION_PREFIX);
    const update: Record<string, unknown> = {
      $set: { fraudReview: review, ...(decision === 'cleared' ? { fraudLevel: FraudLevel.CLEAR } : {}), ...(liftSuspension ? { isSuspended: false } : {}) },
      ...(liftSuspension ? { $unset: { suspendedUntil: 1, suspensionReason: 1 } } : {}),
    };
    const updated = await User.findByIdAndUpdate(userId, update, { new: true });
    await audit(adminId, decision === 'cleared' ? 'fraud.clear' : 'fraud.confirm', 'user', userId, why, { flags: user.fraudFlags ?? [] });
    if (liftSuspension) {
      await tell(userId, 'Account active again', 'We finished checking your account and everything is in order. You can post and book rides again. Sorry for the wait.');
    }
    return { user: updated, suspensionLifted: liftSuspension };
  }

  /** Admin audit log, filterable (UC-A05 step 5). */
  async auditLog(params: { actor?: string; action?: string; targetId?: string; page: number; limit: number }) {
    const filter: Record<string, unknown> = {};
    if (params.actor) filter.actor = params.actor;
    if (params.action) filter.action = new RegExp(`^${escapeRegex(params.action)}`);
    if (params.targetId) filter.targetId = params.targetId;
    const [entries, total] = await Promise.all([
      AdminAuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((params.page - 1) * params.limit)
        .limit(params.limit)
        .populate('actor', 'name email')
        .lean(),
      AdminAuditLog.countDocuments(filter),
    ]);
    return { entries, total, page: params.page, limit: params.limit };
  }
}
