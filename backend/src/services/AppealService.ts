/**
 * AppealService.ts
 *
 * Appeals against a suspension or block (UC-A05 3a). A user can appeal within
 * 30 days of the action, one appeal at a time, and blocked users can still
 * reach this (auth.middleware.ts lets them through to /appeals only). An
 * admin other than the one who took the action decides: overturning lifts
 * the suspension or block; upholding leaves it and tells the user.
 */

import { Types } from 'mongoose';
import { Appeal } from '../models/Appeal';
import { User } from '../models/User';
import { AdminAuditLog } from '../models/AdminAuditLog';
import { AdminUserService } from './AdminUserService';
import { FRAUD_SUSPENSION_PREFIX } from './FraudDetectionService';
import { NotificationService } from './NotificationService';
import { emailUser } from './Mailer';
import { audit } from './AuditService';
import { AppError, NotFoundError } from '../utils/AppError';

export const APPEAL_WINDOW_DAYS = 30;
const DAY = 86_400_000;

async function tell(userId: string, title: string, message: string) {
  const n = new NotificationService();
  await Promise.allSettled([
    n.createNotification(userId, title, message, 'system'),
    n.sendPushNotification(userId, title, message, { type: 'account' }),
    emailUser(userId, title, message),
  ]);
}

export class AppealService {
  private users = new AdminUserService();

  /** The restriction on an account, when it began and who imposed it */
  private async restriction(userId: string) {
    const user = await User.findById(userId).select('isBlocked blockReason isSuspended suspendedUntil suspensionReason fraudFlaggedAt mergedInto').lean();
    if (!user) throw new NotFoundError('User');
    const kind: 'block' | 'suspension' | null = user.isBlocked ? 'block' : user.isSuspended ? 'suspension' : null;
    if (!kind) return { user, kind, reason: undefined, at: undefined, by: undefined };
    const action = await AdminAuditLog.findOne({
      targetId: userId,
      action: kind === 'block' ? 'user.block.approve' : { $in: ['user.suspend', 'dispute.resolve'] },
    })
      .sort({ createdAt: -1 })
      .lean();
    const reason = kind === 'block' ? user.blockReason : user.suspensionReason;
    const automatic = kind === 'suspension' && reason?.startsWith(FRAUD_SUSPENSION_PREFIX);
    const at = action?.createdAt ?? (automatic ? user.fraudFlaggedAt : undefined);
    return { user, kind, reason, at: at ? new Date(at) : undefined, by: action?.actor?.toString() };
  }

  /** What the app shows: the restriction, whether an appeal is possible, and past appeals */
  async mine(userId: string) {
    const r = await this.restriction(userId);
    const appeals = await Appeal.find({ user: userId }).sort({ createdAt: -1 }).limit(10).select('-actionBy').lean();
    const deadline = r.at ? new Date(r.at.getTime() + APPEAL_WINDOW_DAYS * DAY) : undefined;
    const open = appeals.find((a) => a.status === 'open');
    const decidedForThis = r.at && appeals.some((a) => a.status !== 'open' && a.kind === r.kind && a.createdAt >= r.at!);
    return {
      status: r.kind === 'block' ? 'blocked' : r.kind === 'suspension' ? 'suspended' : 'active',
      reason: r.reason,
      suspendedUntil: r.kind === 'suspension' ? r.user.suspendedUntil : undefined,
      appealDeadline: deadline,
      canAppeal: Boolean(r.kind) && !r.user.mergedInto && !open && !decidedForThis && (!deadline || deadline.getTime() > Date.now()),
      appeals,
    };
  }

  async file(userId: string, message: unknown) {
    const text = typeof message === 'string' ? message.trim() : '';
    if (text.length < 20) throw new AppError('Tell us in a few sentences why the decision should change', 422, 'VALIDATION_ERROR');
    const state = await this.mine(userId);
    if (!state.canAppeal) {
      if (state.status === 'active') throw new AppError('Your account has no suspension or block to appeal', 409, 'CONFLICT');
      if (state.appeals.some((a) => a.status === 'open')) throw new AppError('Your appeal is already being reviewed', 409, 'APPEAL_OPEN');
      throw new AppError(`Appeals must be made within ${APPEAL_WINDOW_DAYS} days, once per decision`, 409, 'APPEAL_CLOSED');
    }
    const r = await this.restriction(userId);
    const appeal = await Appeal.create({
      user: new Types.ObjectId(userId),
      kind: r.kind!,
      actionReason: r.reason,
      actionBy: r.by ? new Types.ObjectId(r.by) : undefined,
      actionAt: r.at,
      message: text.slice(0, 2000),
    });
    await tell(userId, 'Appeal received', 'We have your appeal. An admin who was not part of the original decision will review it, usually within 3 working days.');
    return { appeal };
  }

  // ── Admin ────────────────────────────────────────────────────────────────

  async list(status = 'open') {
    const appeals = await Appeal.find(status === 'all' ? {} : { status })
      .sort({ createdAt: status === 'open' ? 1 : -1 })
      .limit(100)
      .populate('user', 'name phone email isBlocked isSuspended suspendedUntil')
      .populate('actionBy', 'name email')
      .populate('decidedBy', 'name email')
      .lean();
    return { appeals };
  }

  async decide(appealId: string, adminId: string, decision: unknown, note: unknown) {
    if (decision !== 'uphold' && decision !== 'overturn') throw new AppError('Choose uphold or overturn', 422, 'VALIDATION_ERROR');
    const why = typeof note === 'string' ? note.trim() : '';
    if (why.length < 5) throw new AppError('Explain the decision in a few words; the user sees it', 422, 'VALIDATION_ERROR');
    if (!Types.ObjectId.isValid(appealId)) throw new NotFoundError('Appeal');
    const appeal = await Appeal.findById(appealId);
    if (!appeal) throw new NotFoundError('Appeal');
    if (appeal.status !== 'open') throw new AppError('This appeal has already been decided', 409, 'CONFLICT');
    if (appeal.actionBy?.toString() === adminId) {
      throw new AppError('An admin who was not part of the original decision must decide the appeal', 403, 'SECOND_ADMIN_REQUIRED');
    }
    const claimed = await Appeal.findOneAndUpdate(
      { _id: appeal._id, status: 'open' },
      { $set: { status: decision === 'overturn' ? 'overturned' : 'upheld', decidedBy: new Types.ObjectId(adminId), decidedAt: new Date(), decisionNote: why } },
      { new: true },
    );
    if (!claimed) throw new AppError('This appeal has already been decided', 409, 'CONFLICT');

    const userId = appeal.user.toString();
    if (decision === 'overturn') {
      const user = await User.findById(userId).select('isBlocked isSuspended').lean();
      // Lifting sends the user its own notice
      if (appeal.kind === 'block' && user?.isBlocked) await this.users.unblock(userId, adminId, `Appeal upheld: ${why}`);
      if (user?.isSuspended) await this.users.reinstate(userId, adminId, `Appeal upheld: ${why}`);
    } else {
      await tell(userId, 'Appeal reviewed', `We looked at your appeal again and the ${appeal.kind} stays in place: ${why}`);
    }
    await audit(adminId, `appeal.${decision}`, 'user', userId, why, { appealId });
    return { appeal: claimed };
  }
}
