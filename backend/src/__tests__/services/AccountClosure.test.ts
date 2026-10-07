/**
 * Closing your own account against a real MongoDB: refused while anything is
 * under way or money is left in the wallet; once closed, personal data is
 * gone, the phone number is free, and records other people rely on remain.
 * The number is remembered (as a hash) so it does not earn new-user perks twice.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const invalidateAllSessions = jest.fn().mockResolvedValue(undefined);
const deleteUser = jest.fn().mockResolvedValue(undefined);
const deleteKycDocuments = jest.fn().mockResolvedValue(2);
jest.mock('../../services/AuthService', () => ({ AuthService: jest.fn().mockImplementation(() => ({ invalidateAllSessions })) }));
jest.mock('../../services/UploadService', () => ({ deleteKycDocuments: (id: string) => deleteKycDocuments(id) }));
jest.mock('../../config/firebase', () => ({ getFirebaseAuth: () => ({ deleteUser }) }));

import { User } from '../../models/User';
import { Booking } from '../../models/Booking';
import { Wallet } from '../../models/Wallet';
import { RideAlert } from '../../models/RideAlert';
import { AdminAuditLog } from '../../models/AdminAuditLog';
import { ClosedPhone } from '../../models/ClosedPhone';
import { AccountClosureService } from '../../services/AccountClosureService';
import { BookingStatus } from '../../types';

jest.setTimeout(60_000);

let mongo: MongoMemoryServer;
const closure = new AccountClosureService();
const userId = new Types.ObjectId();
const otherId = new Types.ObjectId();
const phone = '+263771234567';

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
  await User.syncIndexes();
  await User.collection.insertMany([
    {
      _id: userId, name: 'Tendai Moyo', phone, email: 'tendai@example.com', firebaseUid: 'fb-1', capabilities: ['rider', 'driver'],
      kyc: { status: 'approved', licenseNumber: '123456AB', drivingLicenseUrl: 's3://bucket/kyc/x/licence/a.jpg' },
      vehicles: [{ make: 'Toyota', model: 'Aqua', year: 2016, color: 'White', plateNumber: 'AEA1234', vehicleType: 'hatchback', registrationDocUrl: 's3://b/r', insuranceDocUrl: 's3://b/i' }],
      emergencyContacts: [{ name: 'Rudo', phone: '+263772222222', relation: 'Sister' }],
      fcmTokens: ['tok'], stats: {}, isActive: true, isBlocked: false, isSuspended: false, createdAt: new Date(),
    },
    { _id: otherId, name: 'Other', phone: '+263773333333', capabilities: ['rider'], kyc: { status: 'none' }, stats: {}, isActive: true },
  ]);
  await Wallet.create({ userId, balance: 0, coinBalance: 40 });
});

const booking = (status: BookingStatus) => Booking.collection.insertOne({
  rider: userId, driver: otherId, ride: new Types.ObjectId(), status, seatsBooked: 1, totalAmount: 2, createdAt: new Date(),
});

it('lists what is in the way: an open booking and money in the wallet', async () => {
  await booking(BookingStatus.CONFIRMED);
  await Wallet.updateOne({ userId }, { $set: { balance: 12.5 } });
  const check = await closure.check(userId.toString());
  expect(check.canClose).toBe(false);
  expect(check.blockers.join(' ')).toMatch(/1 open booking/);
  expect(check.blockers.join(' ')).toMatch(/Withdraw it first/);
  // 40 coins are below the 100-coin minimum, so they have no cash value yet
  expect(check).toMatchObject({ coins: 40, coinsValue: 0 });
  await expect(closure.close(userId.toString())).rejects.toMatchObject({ statusCode: 409, errorId: 'ACCOUNT_CLOSE_BLOCKED' });
  expect((await User.findById(userId).lean())?.isActive).toBe(true);
});

it('says what convertible coins are worth', async () => {
  await Wallet.updateOne({ userId }, { $set: { coinBalance: 1600 } });
  expect(await closure.check(userId.toString())).toMatchObject({ canClose: true, coins: 1600, coinsValue: 16 });
});

it('refuses admin accounts', async () => {
  await User.updateOne({ _id: userId }, { $push: { capabilities: 'admin' } });
  expect((await closure.check(userId.toString())).blockers[0]).toMatch(/Admin accounts/);
});

it('closes the account, removes personal data and frees the phone number', async () => {
  await booking(BookingStatus.COMPLETED);
  await RideAlert.collection.insertOne({ rider: userId, createdAt: new Date() });

  const result = await closure.close(userId.toString(), 'Moving abroad');
  expect(result.documentsDeleted).toBe(2);

  const user = await User.findById(userId).lean();
  expect(user).toMatchObject({ isActive: false, name: 'Deleted user', phone: `closed:${userId}`, vehicles: [], emergencyContacts: [], fcmTokens: [] });
  expect(user?.closedAt).toBeInstanceOf(Date);
  expect(user?.email).toBeUndefined();
  expect(user?.firebaseUid).toBeUndefined();
  expect(user?.kyc).toEqual({ status: 'none' });

  // History other people rely on stays; the alert and coins go
  expect(await Booking.countDocuments({ rider: userId })).toBe(1);
  expect(await RideAlert.countDocuments({ rider: userId })).toBe(0);
  expect(await Wallet.findOne({ userId }).lean()).toMatchObject({ isLocked: true, coinBalance: 0 });

  expect(invalidateAllSessions).toHaveBeenCalledWith(userId.toString());
  expect(deleteUser).toHaveBeenCalledWith('fb-1');
  expect(await AdminAuditLog.findOne({ action: 'user.close' }).lean()).toMatchObject({ reason: 'Moving abroad' });

  // The number can sign up again as a new account, but without the new-user perks
  const again = await User.create({ name: 'New Tendai', phone });
  expect(again.newUserPerksUsed).toBe(true);
});

it('remembers only a hash of the number, and only for a while', async () => {
  await closure.close(userId.toString());
  const remembered = await ClosedPhone.findOne().lean();
  expect(remembered?.phoneHash).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(remembered)).not.toContain(phone.slice(1));
  expect(remembered!.expiresAt.getTime() - remembered!.closedAt.getTime()).toBe(365 * 86_400_000);

  // Once the time is up the number counts as new again
  await ClosedPhone.updateOne({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  expect((await User.create({ name: 'Later Tendai', phone })).newUserPerksUsed).toBeUndefined();
  // A number never closed is a normal new user
  expect((await User.create({ name: 'Rudo', phone: '+263774444444' })).newUserPerksUsed).toBeUndefined();
});

it('does not close twice', async () => {
  await closure.close(userId.toString());
  await expect(closure.close(userId.toString())).rejects.toMatchObject({ statusCode: 404 });
});
