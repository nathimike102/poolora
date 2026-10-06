/**
 * Merging duplicate accounts and appeals (UC-A05) against a real MongoDB:
 * two admins, nothing under way on the duplicate, history and money moved
 * once, the duplicate closed; appeals within 30 days, decided by someone
 * other than the admin who acted.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
jest.mock('../../services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    createNotification: jest.fn().mockResolvedValue(undefined),
    sendPushNotification: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { User } from '../../models/User';
import { Booking } from '../../models/Booking';
import { Wallet } from '../../models/Wallet';
import { WalletTransaction } from '../../models/WalletTransaction';
import { AccountMerge } from '../../models/AccountMerge';
import { AccountMergeService } from '../../services/AccountMergeService';
import { AppealService } from '../../services/AppealService';
import { AdminUserService } from '../../services/AdminUserService';
import { checkAccountStatus } from '../../middlewares/accountStatus.middleware';
import { BookingStatus } from '../../types';

jest.setTimeout(60_000);

let mongo: MongoMemoryServer;
const merges = new AccountMergeService();
const appeals = new AppealService();
const users = new AdminUserService();
const [adminA, adminB] = [new Types.ObjectId().toString(), new Types.ObjectId().toString()];
const oldId = new Types.ObjectId();
const keptId = new Types.ObjectId();
const driverId = new Types.ObjectId();

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  await mongoose.connection.db!.dropDatabase();
  await User.collection.insertMany([
    { _id: oldId, name: 'Asha Rao', phone: '+919000001111', email: 'asha@old.in', capabilities: ['rider'], kyc: { status: 'none' }, stats: { totalRidesAsRider: 4, avgRatingAsRider: 5, totalRatingsAsRider: 2 }, fcmTokens: ['tok-1'], warnings: 0, isBlocked: false, isSuspended: false, createdAt: new Date() },
    { _id: keptId, name: 'asha rao', phone: '+919000002222', capabilities: ['rider'], kyc: { status: 'none' }, stats: { totalRidesAsRider: 6, avgRatingAsRider: 4, totalRatingsAsRider: 2 }, fcmTokens: ['tok-2'], warnings: 0, isBlocked: false, isSuspended: false, createdAt: new Date() },
    { _id: driverId, name: 'Ravi', phone: '+919000003333', capabilities: ['rider', 'driver'], kyc: { status: 'approved' }, stats: {}, warnings: 0, createdAt: new Date() },
  ]);
});

const booking = (status: BookingStatus) =>
  Booking.collection.insertOne({ rider: oldId, driver: driverId, ride: new Types.ObjectId(), status, seatsBooked: 1, estimatedFare: 100, createdAt: new Date() });

describe('merging duplicate accounts', () => {
  it('finds the duplicate by name', async () => {
    const { candidates } = await merges.duplicates(keptId.toString());
    expect(candidates.map((c) => String(c._id))).toEqual([oldId.toString()]);
  });

  it('needs a second admin, then moves history, money and coins once and closes the duplicate', async () => {
    await booking(BookingStatus.COMPLETED);
    await Wallet.create({ userId: oldId, balance: 250, coinBalance: 40 });
    await Wallet.create({ userId: keptId, balance: 100, coinBalance: 10 });

    const { merge } = await merges.request(oldId.toString(), keptId.toString(), adminA, 'Same person, new SIM');
    await expect(merges.approve(merge._id.toString(), adminA)).rejects.toMatchObject({ errorId: 'SECOND_ADMIN_REQUIRED' });
    await merges.approve(merge._id.toString(), adminB);

    expect(await Booking.countDocuments({ rider: keptId })).toBe(1);
    const [oldWallet, keptWallet] = await Promise.all([Wallet.findOne({ userId: oldId }).lean(), Wallet.findOne({ userId: keptId }).lean()]);
    expect(oldWallet).toMatchObject({ balance: 0, coinBalance: 0, isLocked: true });
    expect(keptWallet).toMatchObject({ balance: 350, coinBalance: 50 });
    expect(await WalletTransaction.countDocuments({ idempotencyKey: new RegExp(`^merge_${merge._id}`) })).toBe(2);

    const [closed, kept] = await Promise.all([User.findById(oldId), User.findById(keptId).lean()]);
    expect(closed).toMatchObject({ isBlocked: true, mergedInto: keptId });
    expect(closed?.email).toBeUndefined();
    expect(kept).toMatchObject({ email: 'asha@old.in', stats: { totalRidesAsRider: 10, avgRatingAsRider: 4.86, totalRatingsAsRider: 4, ratingSumAsRider: 18 } });
    expect(kept?.mergedFrom?.[0]).toMatchObject({ user: oldId, phone: '+919000001111' });
    await expect(checkAccountStatus(closed!)).rejects.toThrow('number ending 2222');
    await expect(checkAccountStatus(closed!, { allowBlocked: true })).rejects.toMatchObject({ errorId: 'ACCOUNT_MERGED' });

    await expect(merges.approve(merge._id.toString(), adminB)).rejects.toThrow('already completed');
  });

  it('finishes a merge that stopped part-way without moving money twice', async () => {
    await Wallet.create({ userId: oldId, balance: 80 });
    const { merge } = await merges.request(oldId.toString(), keptId.toString(), adminA, 'Duplicate signup');
    await AccountMerge.updateOne({ _id: merge._id }, { status: 'running', decidedBy: adminB });
    await merges.approve(merge._id.toString(), adminB);
    await AccountMerge.updateOne({ _id: merge._id }, { status: 'running' });
    await User.updateOne({ _id: oldId }, { $unset: { mergedInto: 1 } }); // as if it stopped before closing the duplicate
    await merges.approve(merge._id.toString(), adminB);
    expect((await Wallet.findOne({ userId: keptId }).lean())?.balance).toBe(80);
  });

  it('refuses while the duplicate has something under way', async () => {
    await booking(BookingStatus.CONFIRMED);
    await expect(merges.request(oldId.toString(), keptId.toString(), adminA, 'Duplicate signup')).rejects.toThrow('1 open booking');
  });
});

describe('appeals', () => {
  it('lets a suspended user appeal once, decided by a different admin', async () => {
    await users.suspend(oldId.toString(), adminA, 7, 'Repeated late cancellations');
    const state = await appeals.mine(oldId.toString());
    expect(state).toMatchObject({ status: 'suspended', canAppeal: true });

    await expect(appeals.file(oldId.toString(), 'too short')).rejects.toThrow('few sentences');
    const { appeal } = await appeals.file(oldId.toString(), 'My car broke down twice; I have the garage receipts to show it.');
    await expect(appeals.file(oldId.toString(), 'Another appeal with plenty of words in it.')).rejects.toMatchObject({ errorId: 'APPEAL_OPEN' });

    await expect(appeals.decide(appeal._id.toString(), adminA, 'overturn', 'Receipts check out')).rejects.toMatchObject({ errorId: 'SECOND_ADMIN_REQUIRED' });
    await appeals.decide(appeal._id.toString(), adminB, 'overturn', 'Receipts check out');
    expect((await User.findById(oldId).lean())?.isSuspended).toBe(false);
  });

  it('lets a blocked user appeal, and closes the window after 30 days', async () => {
    await users.requestBlock(oldId.toString(), adminA, 'Fake bookings');
    await users.approveBlock(oldId.toString(), adminB);
    const user = await User.findById(oldId);
    expect(await checkAccountStatus(user!, { allowBlocked: true })).toBe('blocked');
    expect((await appeals.mine(oldId.toString())).canAppeal).toBe(true);

    const { AdminAuditLog } = await import('../../models/AdminAuditLog');
    await AdminAuditLog.collection.updateMany({ targetId: oldId.toString() }, { $set: { createdAt: new Date(Date.now() - 31 * 86_400_000) } });
    await expect(appeals.file(oldId.toString(), 'Please look at this again, it was a misunderstanding.')).rejects.toMatchObject({ errorId: 'APPEAL_CLOSED' });
  });
});
