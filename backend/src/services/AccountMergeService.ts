/**
 * AccountMergeService.ts
 *
 * Merging duplicate accounts (UC-A05 step 3d). The policy:
 * - One admin asks, with a reason; a different admin approves.
 * - The duplicate ("source") must have nothing under way: no open bookings,
 *   upcoming rides, parcels in transit, open disputes or active SOS.
 * - History moves to the kept account ("target"): bookings, rides, ratings,
 *   payments, disputes, parcels, messages, trips, support tickets and
 *   notifications. Wallet money and coins move with a ledger entry on each
 *   side. Ride counts and ratings are combined.
 * - The duplicate is closed: blocked, with a note pointing to the kept
 *   account, and its phone number is recorded on the kept one.
 *
 * MongoDB here runs without transactions, so every step is safe to repeat:
 * a merge interrupted part-way is finished by approving it again.
 */

import { ratingScore, ratingSum, type RatingRole } from '../utils/ratingScore';
import { Types } from 'mongoose';
import { AccountMerge, IAccountMerge } from '../models/AccountMerge';
import { User, IUser } from '../models/User';
import { Booking } from '../models/Booking';
import { Ride } from '../models/Ride';
import { Rating } from '../models/Rating';
import { Payment } from '../models/Payment';
import { Dispute } from '../models/Dispute';
import { EmergencyRecord } from '../models/EmergencyRecord';
import { Message } from '../models/Message';
import { ParcelPooling } from '../models/ParcelPooling';
import { RideAlert } from '../models/RideAlert';
import { SupportTicket } from '../models/SupportTicket';
import { Notification } from '../models/Notification';
import { AdminNote } from '../models/AdminNote';
import { Trip } from '../models/Trip';
import { TripExpense } from '../models/TripExpense';
import { Wallet } from '../models/Wallet';
import { WalletTransaction } from '../models/WalletTransaction';
import { CoinLedger } from '../models/CoinLedger';
import {
  BookingStatus,
  CoinTransactionType,
  RideStatus,
  SOSStatus,
  UserCapability,
  WalletTransactionStatus,
  WalletTransactionType,
} from '../types';
import { AppError, NotFoundError } from '../utils/AppError';
import { audit } from './AuditService';
import { NotificationService } from './NotificationService';
import { money } from '../config/region';
import { phrase } from '../i18n';

const MAX_WALLET = 100_000;
const round2 = (n: number) => Math.round(n * 100) / 100;
const oid = (id: string) => new Types.ObjectId(id);

function requireReason(reason: unknown): string {
  const text = typeof reason === 'string' ? reason.trim() : '';
  if (text.length < 5) throw new AppError('Give a reason of at least a few words', 422, 'VALIDATION_ERROR');
  return text;
}

/** Last four digits, for messages that must not show the whole number */
const lastFour = (phone: string) => phone.replace(/\D/g, '').slice(-4);

export class AccountMergeService {
  /**
   * Accounts that look like the same person: the same name, or a phone
   * (push token) they have both signed in on.
   */
  async duplicates(userId: string): Promise<{ candidates: Array<Record<string, unknown>> }> {
    const user = await User.findById(userId).select('name fcmTokens').lean();
    if (!user) throw new NotFoundError('User');
    const or: Record<string, unknown>[] = [{ name: new RegExp(`^${user.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }];
    if (user.fcmTokens?.length) or.push({ fcmTokens: { $in: user.fcmTokens } });
    const matches = await User.find({ _id: { $ne: user._id }, mergedInto: { $exists: false }, $or: or })
      .select('name phone email capabilities kyc.status stats.totalRidesAsRider stats.totalRidesAsDriver isBlocked isSuspended createdAt fcmTokens')
      .limit(20)
      .lean();
    const tokens = new Set(user.fcmTokens ?? []);
    return {
      candidates: matches.map(({ fcmTokens, ...m }): Record<string, unknown> => ({
        ...m,
        sameDevice: (fcmTokens ?? []).some((t) => tokens.has(t)),
        sameName: m.name.toLowerCase() === user.name.toLowerCase(),
      })),
    };
  }

  async list(status?: string) {
    const filter = status ? { status } : {};
    const merges = await AccountMerge.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('source', 'name phone email')
      .populate('target', 'name phone email')
      .populate('requestedBy', 'name email')
      .populate('decidedBy', 'name email')
      .lean();
    return { merges };
  }

  /** The first admin asks to merge `sourceId` (the duplicate) into `targetId` (kept). */
  async request(sourceId: string, targetId: string, adminId: string, reason: unknown) {
    const why = requireReason(reason);
    if (!Types.ObjectId.isValid(sourceId) || !Types.ObjectId.isValid(targetId)) throw new NotFoundError('User');
    if (sourceId === targetId) throw new AppError('Choose two different accounts', 422, 'VALIDATION_ERROR');
    if (sourceId === adminId || targetId === adminId) throw new AppError('You cannot merge your own account', 409, 'CONFLICT');
    const [source, target] = await Promise.all([User.findById(sourceId), User.findById(targetId)]);
    if (!source || !target) throw new NotFoundError('User');
    this.checkPair(source, target);
    await this.checkNothingUnderWay(sourceId);
    if (await AccountMerge.exists({ status: { $in: ['pending', 'running'] }, $or: [{ source: source._id }, { target: source._id }, { source: target._id }] })) {
      throw new AppError('A merge involving these accounts is already waiting', 409, 'MERGE_PENDING');
    }
    const merge = await AccountMerge.create({ source: source._id, target: target._id, reason: why, requestedBy: oid(adminId) });
    await audit(adminId, 'user.merge.request', 'user', sourceId, why, { mergeId: merge._id.toString(), targetId });
    return { merge };
  }

  async reject(mergeId: string, adminId: string, note: unknown) {
    const why = requireReason(note);
    const merge = await AccountMerge.findOneAndUpdate(
      { _id: mergeId, status: 'pending' },
      { $set: { status: 'rejected', decidedBy: oid(adminId), decidedAt: new Date(), decisionNote: why } },
      { new: true },
    );
    if (!merge) throw new AppError('No merge is waiting with this id', 409, 'CONFLICT');
    await audit(adminId, 'user.merge.reject', 'user', merge.source.toString(), why, { mergeId });
    return { merge };
  }

  /** A second admin approves; the merge runs at once. Approving a merge that stopped part-way finishes it. */
  async approve(mergeId: string, adminId: string) {
    if (!Types.ObjectId.isValid(mergeId)) throw new NotFoundError('Merge');
    const merge = await AccountMerge.findById(mergeId);
    if (!merge) throw new NotFoundError('Merge');
    if (merge.status === 'completed' || merge.status === 'rejected') throw new AppError(`This merge was already ${merge.status}`, 409, 'CONFLICT');
    if (merge.requestedBy.toString() === adminId) {
      throw new AppError('A different admin must approve a merge you asked for', 403, 'SECOND_ADMIN_REQUIRED');
    }
    const [source, target] = await Promise.all([User.findById(merge.source), User.findById(merge.target)]);
    if (!source || !target) throw new NotFoundError('User');
    if (merge.status === 'pending') {
      this.checkPair(source, target);
      await this.checkNothingUnderWay(source._id.toString());
      const claimed = await AccountMerge.findOneAndUpdate(
        { _id: merge._id, status: 'pending' },
        { $set: { status: 'running', decidedBy: oid(adminId), decidedAt: new Date() } },
      );
      if (!claimed) throw new AppError('Another admin is approving this merge', 409, 'CONFLICT');
    }

    const moved = await this.run(merge, source, target);
    await AccountMerge.updateOne({ _id: merge._id }, { $set: { status: 'completed', moved } });
    await audit(adminId, 'user.merge.approve', 'user', source._id.toString(), merge.reason, { mergeId, targetId: target._id.toString(), moved });
    const n = new NotificationService();
    const message = phrase('account.mergedBody', { lastFour: lastFour(source.phone) });
    await Promise.allSettled([
      n.createNotification(target._id.toString(), phrase('account.mergedTitle'), message, 'system'),
      n.sendPushNotification(target._id.toString(), phrase('account.mergedTitle'), message, { type: 'account' }),
    ]);
    return { merge: await AccountMerge.findById(merge._id).lean() };
  }

  private checkPair(source: IUser, target: IUser) {
    if (source.mergedInto || target.mergedInto) throw new AppError('One of these accounts has already been merged', 409, 'CONFLICT');
    if (target.isBlocked) throw new AppError('The account to keep is blocked; unblock it or keep the other one', 409, 'CONFLICT');
    if ([source, target].some((u) => u.capabilities.includes(UserCapability.ADMIN))) {
      throw new AppError('Admin accounts cannot be merged', 409, 'CONFLICT');
    }
  }

  /** The duplicate must have nothing in progress, so nothing is moved mid-trip */
  private async checkNothingUnderWay(sourceId: string) {
    const id = oid(sourceId);
    const open = [BookingStatus.PENDING, BookingStatus.CONFIRMED];
    const [bookings, rides, parcels, disputes, sos] = await Promise.all([
      Booking.countDocuments({ $or: [{ rider: id }, { driver: id }], status: { $in: open } }),
      Ride.countDocuments({ driver: id, status: { $in: [RideStatus.SCHEDULED, RideStatus.ACTIVE, RideStatus.IN_PROGRESS] } }),
      ParcelPooling.countDocuments({ $or: [{ sender: id }, { driver: id }], status: { $in: open } }),
      Dispute.countDocuments({ $or: [{ raisedBy: id }, { against: id }], status: { $ne: 'resolved' } }),
      EmergencyRecord.countDocuments({ triggeredBy: id, status: { $in: [SOSStatus.TRIGGERED, SOSStatus.ACKNOWLEDGED] } }),
    ]);
    const busy = [
      bookings && `${bookings} open booking${bookings === 1 ? '' : 's'}`,
      rides && `${rides} upcoming ride${rides === 1 ? '' : 's'}`,
      parcels && `${parcels} parcel${parcels === 1 ? '' : 's'} in progress`,
      disputes && `${disputes} open dispute${disputes === 1 ? '' : 's'}`,
      sos && 'an active SOS',
    ].filter(Boolean);
    if (busy.length) {
      throw new AppError(`The duplicate account still has ${busy.join(', ')}. Wait until they finish.`, 409, 'MERGE_BLOCKED');
    }
  }

  private async run(merge: IAccountMerge, source: IUser, target: IUser): Promise<Record<string, number>> {
    const from = source._id;
    const to = target._id;
    const moved: Record<string, number> = {};
    const repoint = async (label: string, model: { updateMany: (f: object, u: object) => Promise<{ modifiedCount: number }> }, fields: string[]) => {
      let n = 0;
      for (const field of fields) n += (await model.updateMany({ [field]: from }, { $set: { [field]: to } })).modifiedCount;
      moved[label] = (moved[label] ?? 0) + n;
    };

    await repoint('bookings', Booking, ['rider', 'driver', 'cancelledBy']);
    await repoint('rides', Ride, ['driver']);
    await repoint('ratings', Rating, ['rater', 'ratee']);
    await repoint('payments', Payment, ['rider', 'driver']);
    await repoint('disputes', Dispute, ['raisedBy', 'against']);
    await repoint('sos', EmergencyRecord, ['triggeredBy']);
    await repoint('messages', Message, ['sender', 'receiver']);
    await repoint('parcels', ParcelPooling, ['sender', 'receiver', 'driver', 'cancelledBy']);
    await repoint('rideAlerts', RideAlert, ['rider']);
    await repoint('supportTickets', SupportTicket, ['user']);
    await repoint('notifications', Notification, ['user']);
    await repoint('adminNotes', AdminNote, ['user']);

    // Trips: move membership unless the kept account is already on that trip
    const tripsMoved = await Trip.find({ $and: [{ 'members.user': from }, { 'members.user': { $ne: to } }] }).select('_id');
    for (const t of tripsMoved) {
      await Trip.updateOne(
        { _id: t._id },
        { $set: { 'members.$[m].user': to } },
        { arrayFilters: [{ 'm.user': from }] },
      );
      await Trip.updateOne({ _id: t._id, organizer: from }, { $set: { organizer: to } });
      await TripExpense.updateMany({ trip: t._id, paidBy: from }, { $set: { paidBy: to } });
      await TripExpense.updateMany({ trip: t._id, createdBy: from }, { $set: { createdBy: to } });
      await TripExpense.updateMany({ trip: t._id, splitAmong: from }, { $set: { 'splitAmong.$[s]': to } }, { arrayFilters: [{ s: from }] });
    }
    moved.trips = tripsMoved.length;

    Object.assign(moved, await this.moveMoney(merge, from, to));

    // Combined stats: totals add up; averages are weighted by their counts
    const a = source.stats ?? ({} as IUser['stats']);
    const b = target.stats ?? ({} as IUser['stats']);
    const weighted = (x = 0, nx = 0, y = 0, ny = 0) => (nx + ny ? round2((x * nx + y * ny) / (nx + ny)) : 0);
    // Ratings: the sums and counts add up, and the score is worked out again from them
    const mergedRating = (role: RatingRole) => {
      const sum = ratingSum(a, role) + ratingSum(b, role);
      const count = (a[`totalRatingsAs${role}`] ?? 0) + (b[`totalRatingsAs${role}`] ?? 0);
      return { [`avgRatingAs${role}`]: ratingScore(sum, count), [`totalRatingsAs${role}`]: count, [`ratingSumAs${role}`]: sum };
    };
    const rides = (u: IUser['stats']) => (u.totalRidesAsDriver ?? 0) + (u.totalRidesAsRider ?? 0);
    const stats = {
      totalRidesAsDriver: (a.totalRidesAsDriver ?? 0) + (b.totalRidesAsDriver ?? 0),
      totalRidesAsRider: (a.totalRidesAsRider ?? 0) + (b.totalRidesAsRider ?? 0),
      totalEarnings: round2((a.totalEarnings ?? 0) + (b.totalEarnings ?? 0)),
      totalSpent: round2((a.totalSpent ?? 0) + (b.totalSpent ?? 0)),
      ...mergedRating('Driver'),
      ...mergedRating('Rider'),
      ...mergedRating('Organizer'),
      cancellationRate: weighted(a.cancellationRate, rides(a), b.cancellationRate, rides(b)),
      acceptanceRate: weighted(a.acceptanceRate ?? 1, a.totalRidesAsDriver, b.acceptanceRate ?? 1, b.totalRidesAsDriver) || (b.acceptanceRate ?? 1),
    };

    const set: Record<string, unknown> = { stats };
    const capabilities = [...new Set([...target.capabilities, ...source.capabilities.filter((c) => c !== UserCapability.ADMIN)])];
    set.capabilities = capabilities;
    // A verified driver record, vehicles and emergency contacts come across only where the kept account has none
    if (target.kyc?.status === 'none' && source.kyc?.status && source.kyc.status !== 'none') set.kyc = source.kyc;
    if (!target.vehicles?.length && source.vehicles?.length) set.vehicles = source.vehicles;
    if (!target.emergencyContacts?.length && source.emergencyContacts?.length) set.emergencyContacts = source.emergencyContacts;
    if (!target.email && source.email) {
      set.email = source.email;
      if (source.emailVerifiedAt) set.emailVerifiedAt = source.emailVerifiedAt;
    }

    // Close the duplicate first so its email is free for the kept account
    await User.updateOne(
      { _id: from },
      {
        $set: { isBlocked: true, blockReason: `Merged into another account (phone ending ${lastFour(target.phone)})`, mergedInto: to, fcmTokens: [] },
        $unset: { email: 1, emailVerifiedAt: 1, pendingBlock: 1 },
      },
    );
    await User.updateOne(
      { _id: to, 'mergedFrom.user': { $ne: from } },
      { $set: set, $push: { mergedFrom: { user: from, phone: source.phone, at: new Date() } } },
    );
    return moved;
  }

  /** Moves the wallet balance and coins, with a ledger entry on each side. Repeat-safe by key. */
  private async moveMoney(merge: IAccountMerge, from: Types.ObjectId, to: Types.ObjectId) {
    const out = { walletAmount: 0, coins: 0 };
    const sourceWallet = await Wallet.findOne({ userId: from });
    if (!sourceWallet) return out;
    let targetWallet = await Wallet.findOne({ userId: to });
    targetWallet ??= await Wallet.create({ userId: to });
    const key = `merge_${merge._id}`;

    const amount = round2(sourceWallet.balance);
    if (amount > 0 && !(await WalletTransaction.exists({ idempotencyKey: `${key}_in` }))) {
      if (targetWallet.balance + amount > MAX_WALLET) {
        throw new AppError(`Together the wallets would hold more than ${money(MAX_WALLET)}; refund part of the duplicate's balance first`, 409, 'WALLET_LIMIT');
      }
      const debited = await Wallet.findOneAndUpdate({ _id: sourceWallet._id, balance: { $gte: amount } }, { $inc: { balance: -amount } }, { new: true });
      if (debited) {
        await WalletTransaction.create({
          wallet: sourceWallet._id, userId: from, type: WalletTransactionType.MERGE_OUT, amount,
          balanceBefore: amount, balanceAfter: debited.balance, status: WalletTransactionStatus.COMPLETED,
          description: 'Moved to your other account on merge', idempotencyKey: `${key}_out`,
        });
        const credited = await Wallet.findOneAndUpdate({ _id: targetWallet._id }, { $inc: { balance: amount } }, { new: true });
        await WalletTransaction.create({
          wallet: targetWallet._id, userId: to, type: WalletTransactionType.MERGE_IN, amount,
          balanceBefore: round2(credited!.balance - amount), balanceAfter: credited!.balance, status: WalletTransactionStatus.COMPLETED,
          description: 'From your merged duplicate account', idempotencyKey: `${key}_in`,
        });
        out.walletAmount = amount;
      }
    }

    const coins = sourceWallet.coinBalance;
    if (coins > 0 && !(await CoinLedger.exists({ userId: to, description: `Merged from account ${from} (${key})` }))) {
      const debited = await Wallet.findOneAndUpdate({ _id: sourceWallet._id, coinBalance: { $gte: coins } }, { $inc: { coinBalance: -coins } }, { new: true });
      if (debited) {
        await CoinLedger.create({ wallet: sourceWallet._id, userId: from, type: CoinTransactionType.MERGE_OUT, coins, balanceBefore: coins, balanceAfter: debited.coinBalance, description: `Moved to account ${to} (${key})` });
        const credited = await Wallet.findOneAndUpdate(
          { _id: targetWallet._id },
          { $inc: { coinBalance: coins, totalRidesCompleted: sourceWallet.totalRidesCompleted } },
          { new: true },
        );
        await CoinLedger.create({ wallet: targetWallet._id, userId: to, type: CoinTransactionType.MERGE_IN, coins, balanceBefore: credited!.coinBalance - coins, balanceAfter: credited!.coinBalance, description: `Merged from account ${from} (${key})` });
        out.coins = coins;
      }
    }
    await Wallet.updateOne({ _id: sourceWallet._id }, { $set: { isLocked: true, lockReason: 'Account merged' } });
    return out;
  }
}
