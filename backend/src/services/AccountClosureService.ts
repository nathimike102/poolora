/**
 * AccountClosureService.ts
 *
 * A user closes their own account from the app (data protection: the right
 * to erasure; also required by Google Play for apps that create accounts).
 *
 * The policy:
 * - Nothing may be under way: no open bookings, upcoming rides, parcels in
 *   progress, open disputes, active SOS, trips being planned or under way,
 *   or withdrawals waiting to be paid.
 * - The wallet must be empty. Money is never forfeited: the user withdraws
 *   it first (Settings, Wallet, Withdraw). Coins, which are not money, are
 *   given up.
 * - Admin accounts cannot close themselves.
 *
 * On closing, personal data goes: name, email, date of birth, photo, the
 * driver's licence details and vehicles, KYC files in S3, emergency contacts,
 * push tokens, location, ride alerts and notifications. The phone number is
 * freed so it can sign up again as a new account. Bookings, payments,
 * ratings and chats stay, pointing at the anonymous account, because tax law
 * requires the payment records and the other party's history is theirs too.
 * Every step can be repeated safely.
 */

import { Types } from 'mongoose';
import { User } from '../models/User';
import { Booking } from '../models/Booking';
import { Ride } from '../models/Ride';
import { Dispute } from '../models/Dispute';
import { EmergencyRecord } from '../models/EmergencyRecord';
import { ParcelPooling } from '../models/ParcelPooling';
import { RideAlert } from '../models/RideAlert';
import { Notification } from '../models/Notification';
import { Trip } from '../models/Trip';
import { Wallet } from '../models/Wallet';
import { WithdrawalRequest } from '../models/WithdrawalRequest';
import { BookingStatus, KYCStatus, RideStatus, SOSStatus, UserCapability } from '../types';
import { AppError, NotFoundError } from '../utils/AppError';
import { audit } from './AuditService';
import { AuthService } from './AuthService';
import { deleteKycDocuments } from './UploadService';
import { getFirebaseAuth } from '../config/firebase';
import { money } from '../config/region';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface ClosureCheck {
  canClose: boolean;
  /** Plain-language reasons the account cannot be closed yet */
  blockers: string[];
  walletBalance: number;
  coins: number;
  /** What the coins would add to the wallet if converted now; 0 below the minimum conversion */
  coinsValue: number;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export class AccountClosureService {
  /** What stands in the way of closing, for the app to show before asking. */
  async check(userId: string): Promise<ClosureCheck> {
    if (!Types.ObjectId.isValid(userId)) throw new NotFoundError('User');
    const id = new Types.ObjectId(userId);
    const user = await User.findById(id).select('capabilities isActive').lean();
    if (!user || !user.isActive) throw new NotFoundError('User');

    const open = [BookingStatus.PENDING, BookingStatus.CONFIRMED];
    const [bookings, rides, parcels, disputes, sos, trips, withdrawals, wallet] = await Promise.all([
      Booking.countDocuments({ $or: [{ rider: id }, { driver: id }], status: { $in: open } }),
      Ride.countDocuments({ driver: id, status: { $in: [RideStatus.SCHEDULED, RideStatus.ACTIVE, RideStatus.IN_PROGRESS] } }),
      ParcelPooling.countDocuments({ $or: [{ sender: id }, { driver: id }], status: { $in: open } }),
      Dispute.countDocuments({ $or: [{ raisedBy: id }, { against: id }], status: { $ne: 'resolved' } }),
      EmergencyRecord.countDocuments({ triggeredBy: id, status: { $in: [SOSStatus.TRIGGERED, SOSStatus.ACKNOWLEDGED] } }),
      Trip.countDocuments({ 'members.user': id, status: { $in: ['planning', 'ongoing'] } }),
      WithdrawalRequest.countDocuments({ user: id, status: 'pending' }),
      Wallet.findOne({ userId: id }).select('balance coinBalance').lean(),
    ]);

    const walletBalance = Math.round((wallet?.balance ?? 0) * 100) / 100;
    const blockers = [
      user.capabilities.includes(UserCapability.ADMIN) && 'Admin accounts cannot be closed from the app. Ask another admin.',
      bookings && `You have ${plural(bookings, 'open booking')}. Finish or cancel them first.`,
      rides && `You have ${plural(rides, 'upcoming ride')} as a driver. Complete or cancel them first.`,
      parcels && `You have ${plural(parcels, 'parcel')} in progress.`,
      disputes && `You have ${plural(disputes, 'open dispute')}. Wait until they are resolved.`,
      sos && 'You have an active SOS.',
      trips && `You are on ${plural(trips, 'group trip')} that has not finished. Leave it first, once your share is settled.`,
      withdrawals && 'A withdrawal from your wallet is still being paid out.',
      walletBalance > 0 && `Your wallet holds ${money(walletBalance)}. Withdraw it first so you do not lose it.`,
    ].filter((b): b is string => typeof b === 'string');

    const coins = wallet?.coinBalance ?? 0;
    const { coinToUsdRate, minCoinConversion } = config.wallet;
    const coinsValue = coins >= minCoinConversion ? Math.round(coins * coinToUsdRate * 100) / 100 : 0;
    return { canClose: blockers.length === 0, blockers, walletBalance, coins, coinsValue };
  }

  /** Closes the account and removes the personal data. */
  async close(userId: string, reason?: string): Promise<{ closedAt: Date; documentsDeleted: number }> {
    const status = await this.check(userId);
    if (!status.canClose) {
      throw new AppError(status.blockers.join(' '), 409, 'ACCOUNT_CLOSE_BLOCKED');
    }
    const id = new Types.ObjectId(userId);
    const user = await User.findById(id).select('firebaseUid');
    if (!user) throw new NotFoundError('User');
    const firebaseUid = user.firebaseUid;
    const closedAt = new Date();

    // Close first, so the account stops working even if a clean-up step fails
    await User.updateOne(
      { _id: id },
      {
        $set: {
          isActive: false,
          closedAt,
          name: 'Deleted user',
          // Frees the number for a new sign-up; still unique for the index
          phone: `closed:${userId}`,
          capabilities: [UserCapability.RIDER],
          kyc: { status: KYCStatus.NONE },
          vehicles: [],
          emergencyContacts: [],
          fcmTokens: [],
        },
        $unset: {
          firebaseUid: 1, email: 1, dateOfBirth: 1, gender: 1, identity: 1, profilePhotoUrl: 1,
          lastKnownLocation: 1, pendingBlock: 1, otpLastAttemptAt: 1,
        },
      },
    );
    await Wallet.updateOne({ userId: id }, { $set: { isLocked: true, lockReason: 'Account closed', coinBalance: 0 } });

    const [alerts, notifications] = await Promise.all([
      RideAlert.deleteMany({ rider: id }),
      Notification.deleteMany({ user: id }),
    ]);

    // Best effort from here: the account is already closed
    let documentsDeleted = 0;
    try {
      documentsDeleted = await deleteKycDocuments(userId);
    } catch (error) {
      logger.error('Could not delete KYC files of a closed account', { userId, error: (error as Error).message });
    }
    try {
      await new AuthService().invalidateAllSessions(userId);
    } catch (error) {
      logger.warn('Could not revoke sessions of a closed account', { userId, error: (error as Error).message });
    }
    if (firebaseUid) {
      try {
        await getFirebaseAuth().deleteUser(firebaseUid);
      } catch (error) {
        logger.warn('Could not delete the Firebase user of a closed account', { userId, error: (error as Error).message });
      }
    }

    await audit(userId, 'user.close', 'user', userId, reason?.trim().slice(0, 500) || 'Closed by the user', {
      documentsDeleted,
      rideAlerts: alerts.deletedCount,
      notifications: notifications.deletedCount,
      coinsForfeited: status.coins,
    });
    logger.info('Account closed by its owner', { userId });
    return { closedAt, documentsDeleted };
  }
}
