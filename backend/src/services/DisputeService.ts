/**
 * DisputeService.ts
 *
 * A rider or driver raises a dispute about one of their bookings; an admin
 * reviews the evidence and decides (UC-A04). The decision is carried out
 * here: refunds to the rider, compensation to the driver's wallet, warnings
 * and suspensions, and a notification to both parties.
 */

import { Types } from 'mongoose';
import { Booking } from '../models/Booking';
import { Dispute, DISPUTE_CATEGORIES, DISPUTE_OUTCOMES, DisputeCategory, DisputeOutcome } from '../models/Dispute';
import { Message } from '../models/Message';
import { Payment } from '../models/Payment';
import { Rating } from '../models/Rating';
import { EmergencyRecord } from '../models/EmergencyRecord';
import { User } from '../models/User';
import { AdminAuditLog } from '../models/AdminAuditLog';
import { BookingStatus } from '../types';
import { AppError, AuthorizationError, ConflictError, NotFoundError } from '../utils/AppError';
import { audit } from './AuditService';
import { BookingService, RefundOutcome } from './BookingService';
import { WalletService } from './WalletService';
import { NotificationService } from './NotificationService';
import { emailUser } from './Mailer';
import { AdminUserService } from './AdminUserService';
import { money } from '../config/region';
import { riderPays } from '../utils/fares';

/** Disputes can be raised up to this long after the booking was made or the ride ended. */
const RAISE_WINDOW_DAYS = 30;

const round2 = (n: number) => Math.round(n * 100) / 100;

async function tell(userId: string, title: string, message: string): Promise<void> {
  const notifications = new NotificationService();
  await Promise.allSettled([
    notifications.createNotification(userId, title, message, 'system'),
    notifications.sendPushNotification(userId, title, message, { type: 'dispute' }),
    emailUser(userId, title, message),
  ]);
}

export interface DisputeDecisionInput {
  outcome: DisputeOutcome;
  refundAmount?: number;
  driverCompensation?: number;
  warn?: Array<'rider' | 'driver'>;
  suspend?: Array<'rider' | 'driver'>;
  suspendDays?: number | null;
  justification: string;
}

export class DisputeService {
  private bookings = new BookingService();
  private wallets = new WalletService();
  private users = new AdminUserService();

  /** Raised from the app by the booking's rider or driver. */
  async create(
    userId: string,
    data: { bookingId: string; category: string; description: string; evidenceUrls?: string[] },
  ) {
    if (!DISPUTE_CATEGORIES.includes(data.category as DisputeCategory)) {
      throw new AppError('Unknown dispute category', 422, 'VALIDATION_ERROR');
    }
    const description = data.description?.trim() ?? '';
    if (description.length < 10) throw new AppError('Describe what happened in a sentence or two', 422, 'VALIDATION_ERROR');

    const booking = await Booking.findById(data.bookingId);
    if (!booking) throw new NotFoundError('Booking');
    const isRider = booking.rider.toString() === userId;
    if (!isRider && booking.driver.toString() !== userId) throw new AuthorizationError('You are not part of this booking');
    if (booking.status === BookingStatus.PENDING) {
      throw new ConflictError('A request the driver has not answered cannot be disputed yet');
    }
    const since = booking.actualDropoffTime ?? booking.cancelledAt ?? booking.createdAt;
    if (Date.now() - since.getTime() > RAISE_WINDOW_DAYS * 86_400_000) {
      throw new ConflictError(`Disputes can be raised within ${RAISE_WINDOW_DAYS} days`);
    }
    const open = await Dispute.exists({ booking: booking._id, raisedBy: userId, status: { $ne: 'resolved' } });
    if (open) throw new ConflictError('You already have an open dispute about this booking');

    const evidenceUrls = (data.evidenceUrls ?? []).filter((u) => /^https:\/\//.test(u)).slice(0, 5);
    // Where the car and the riders went, kept with the dispute
    const { keepTripTrail } = await import('./TripTrailService');
    await keepTripTrail(booking.ride);
    return Dispute.create({
      booking: booking._id,
      ride: booking.ride,
      raisedBy: userId,
      against: isRider ? booking.driver : booking.rider,
      category: data.category,
      description: description.slice(0, 2000),
      evidenceUrls,
    });
  }

  async mine(userId: string) {
    return Dispute.find({ $or: [{ raisedBy: userId }, { against: userId }] })
      .select('-assignedTo')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
  }

  async list(params: { status?: string; category?: string; page: number; limit: number }) {
    const filter: Record<string, unknown> = {};
    if (params.status) filter.status = params.status;
    if (params.category) filter.category = params.category;
    const [disputes, total] = await Promise.all([
      Dispute.find(filter)
        .sort({ status: 1, createdAt: 1 })
        .skip((params.page - 1) * params.limit)
        .limit(params.limit)
        .populate('raisedBy', 'name phone')
        .populate('against', 'name phone')
        .populate('assignedTo', 'name email')
        .lean(),
      Dispute.countDocuments(filter),
    ]);
    return { disputes, total, page: params.page, limit: params.limit };
  }

  /** The case file: the dispute and all the evidence around it (UC-A04 steps 2-3). */
  async detail(disputeId: string) {
    const dispute = await Dispute.findById(disputeId)
      .populate('assignedTo', 'name email')
      .populate('decision.decidedBy', 'name email')
      .lean();
    if (!dispute) throw new NotFoundError('Dispute');
    const booking = await Booking.findById(dispute.booking)
      .populate('ride', 'pickup.address dropoff.address departureTime startedAt completedAt status estimatedDistanceKm pricePerSeat')
      .lean();
    if (!booking) throw new NotFoundError('Booking');
    const partySelect = 'name phone email gender stats warnings isSuspended suspendedUntil isBlocked fraudLevel createdAt';
    const [rider, driver, messages, payments, ratings, sos, riderDisputes, driverDisputes, history] = await Promise.all([
      User.findById(booking.rider).select(partySelect).lean(),
      User.findById(booking.driver).select(partySelect).lean(),
      Message.find({ booking: booking._id }).sort({ createdAt: 1 }).limit(500).lean(),
      Payment.find({ booking: booking._id }).lean(),
      Rating.find({ booking: booking._id }).lean(),
      EmergencyRecord.find({ booking: booking._id }).select('status riskLevel createdAt timeline').lean(),
      Dispute.find({ _id: { $ne: dispute._id }, $or: [{ raisedBy: booking.rider }, { against: booking.rider }] }).select('category status decision.outcome createdAt').lean(),
      Dispute.find({ _id: { $ne: dispute._id }, $or: [{ raisedBy: booking.driver }, { against: booking.driver }] }).select('category status decision.outcome createdAt').lean(),
      AdminAuditLog.find({ targetType: 'dispute', targetId: disputeId }).sort({ createdAt: 1 }).populate('actor', 'name email').lean(),
    ]);
    // What the rider paid; a company's part is settled on its bill
    const paid = riderPays(booking);
    return {
      dispute,
      booking,
      rider,
      driver,
      raisedByRole: dispute.raisedBy.toString() === booking.rider.toString() ? 'rider' : 'driver',
      messages,
      payments,
      ratings,
      sos,
      previousDisputes: { rider: riderDisputes, driver: driverDisputes },
      history,
      /** Most that can still be refunded to the rider */
      refundable: round2(Math.max(0, paid - (booking.refundAmount ?? 0))),
    };
  }

  /** An admin takes the case. */
  async assign(disputeId: string, adminId: string) {
    const dispute = await Dispute.findOneAndUpdate(
      { _id: disputeId, status: { $ne: 'resolved' } },
      { $set: { status: 'in_review', assignedTo: new Types.ObjectId(adminId) } },
      { new: true },
    );
    if (!dispute) throw new ConflictError('This dispute is already resolved');
    await audit(adminId, 'dispute.assign', 'dispute', disputeId);
    return dispute;
  }

  /** Records the decision and carries it out (UC-A04 steps 6-9). */
  async resolve(disputeId: string, adminId: string, input: DisputeDecisionInput) {
    if (!DISPUTE_OUTCOMES.includes(input.outcome)) throw new AppError('Choose an outcome', 422, 'VALIDATION_ERROR');
    const justification = input.justification?.trim() ?? '';
    if (justification.length < 10) throw new AppError('Explain the decision in a sentence or two', 422, 'VALIDATION_ERROR');

    const dispute = await Dispute.findById(disputeId);
    if (!dispute) throw new NotFoundError('Dispute');
    if (dispute.status === 'resolved') throw new ConflictError('This dispute is already resolved');
    const booking = await Booking.findById(dispute.booking);
    if (!booking) throw new NotFoundError('Booking');

    const paid = riderPays(booking);
    const refundable = round2(Math.max(0, paid - (booking.refundAmount ?? 0)));
    const refundAmount = round2(Number(input.refundAmount ?? 0));
    const driverCompensation = round2(Number(input.driverCompensation ?? 0));
    if (!(refundAmount >= 0) || refundAmount > refundable) {
      throw new AppError(`The refund must be between ${money(0)} and ${money(refundable)}`, 422, 'VALIDATION_ERROR');
    }
    if (!(driverCompensation >= 0) || driverCompensation > paid) {
      throw new AppError(`Compensation must be between ${money(0)} and ${money(paid)}`, 422, 'VALIDATION_ERROR');
    }
    if (input.suspend?.length && input.suspendDays === undefined) {
      throw new AppError('Choose how long to suspend for', 422, 'VALIDATION_ERROR');
    }

    // Claim the dispute first, so a second admin cannot decide it in parallel
    const claimed = await Dispute.findOneAndUpdate(
      { _id: disputeId, status: { $ne: 'resolved' } },
      { $set: { status: 'resolved' } },
    );
    if (!claimed) throw new ConflictError('This dispute is already resolved');

    const riderId = booking.rider.toString();
    const driverId = booking.driver.toString();
    const idOf = (party: 'rider' | 'driver') => (party === 'rider' ? riderId : driverId);
    const reason = `Dispute decision: ${justification}`;

    let refundStatus: RefundOutcome = 'none';
    if (refundAmount > 0) {
      refundStatus = await this.bookings.refundBooking(booking, reason, adminId, refundAmount, `dispute_${disputeId}_refund`);
      if (refundStatus !== 'failed' && refundStatus !== 'none') {
        booking.refundAmount = round2((booking.refundAmount ?? 0) + refundAmount);
        await booking.save();
      }
    }
    if (driverCompensation > 0) {
      await this.wallets.refundToWallet(driverId, booking._id.toString(), driverCompensation, reason, `dispute_${disputeId}_compensation`);
    }

    const warned = [...new Set(input.warn ?? [])].map(idOf);
    if (warned.length) await User.updateMany({ _id: { $in: warned } }, { $inc: { warnings: 1 } });

    const suspended = [...new Set(input.suspend ?? [])].map(idOf);
    for (const userId of suspended) {
      await this.users.suspend(userId, adminId, input.suspendDays ?? null, `Dispute decision: ${justification}`);
    }

    dispute.status = 'resolved';
    dispute.decision = {
      outcome: input.outcome,
      refundAmount,
      refundStatus,
      driverCompensation,
      warned: warned.map((id) => new Types.ObjectId(id)),
      suspended: suspended.map((id) => new Types.ObjectId(id)),
      suspendedDays: suspended.length ? input.suspendDays ?? null : undefined,
      justification,
      decidedBy: new Types.ObjectId(adminId),
      decidedAt: new Date(),
    };
    await dispute.save();

    await audit(adminId, 'dispute.resolve', 'dispute', disputeId, justification, {
      outcome: input.outcome,
      refundAmount,
      refundStatus,
      driverCompensation,
      warned,
      suspended,
    });

    const summary = [
      refundAmount > 0 ? `${money(refundAmount)} is refunded to the rider.` : '',
      driverCompensation > 0 ? `${money(driverCompensation)} is paid to the driver's wallet.` : '',
    ].filter(Boolean).join(' ');
    for (const party of ['rider', 'driver'] as const) {
      const id = idOf(party);
      const warning = warned.includes(id) ? ' You have received a warning; repeated problems can lead to suspension.' : '';
      await tell(id, 'Dispute resolved', `${justification}${summary ? ` ${summary}` : ''}${warning}`);
    }
    return dispute;
  }
}
