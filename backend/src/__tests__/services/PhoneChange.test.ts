/**
 * Adding or changing the phone number on a signed-in account, against a real
 * MongoDB (the code store used when Redis is down): the number is proved with
 * a code, another account's number is refused, and a recently closed number
 * brings no new-user perks.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('../../config/redis', () => ({ getRedisClient: () => null, requireRedis: () => null }));
jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
jest.mock('../../utils/helpers', () => ({ ...jest.requireActual('../../utils/helpers'), generateOTP: () => '123456' }));

import { User } from '../../models/User';
import { OtpChallenge } from '../../models/OtpChallenge';
import { rememberClosedPhone } from '../../models/ClosedPhone';
import { AuthService } from '../../services/AuthService';

jest.setTimeout(60_000);

let mongo: MongoMemoryServer;
const auth = new AuthService();
const googleUser = new Types.ObjectId();
const phoneUser = new Types.ObjectId();

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
    { _id: googleUser, name: 'Rudo', phone: 'firebase:abc', email: 'rudo@example.com', capabilities: ['rider'], isActive: true, stats: {} },
    { _id: phoneUser, name: 'Tendai', phone: '+263771111111', capabilities: ['rider'], isActive: true, stats: {} },
  ]);
});

it('adds a number once its code is right', async () => {
  await auth.sendPhoneCode(googleUser.toString(), '+263772222222');
  await expect(auth.confirmPhone(googleUser.toString(), '+263772222222', '000000')).rejects.toThrow(/Invalid OTP/);
  // A wrong code means a short wait, as at sign-in; skip it
  await expect(auth.confirmPhone(googleUser.toString(), '+263772222222', '123456')).rejects.toMatchObject({ statusCode: 429 });
  await OtpChallenge.updateOne({ phone: '+263772222222' }, { $set: { retryAfter: null } });
  const user = await auth.confirmPhone(googleUser.toString(), '+263772222222', '123456');
  expect(user.phone).toBe('+263772222222');
  expect(user.newUserPerksUsed).toBeUndefined();
  // The code is used up
  expect(await OtpChallenge.countDocuments({ phone: '+263772222222' })).toBe(0);
  await expect(auth.confirmPhone(googleUser.toString(), '+263772222222', '123456')).rejects.toThrow(/expired or not requested/);
});

it("refuses another account's number, before and after the code", async () => {
  await expect(auth.sendPhoneCode(googleUser.toString(), '+263771111111')).rejects.toMatchObject({ statusCode: 409 });
  await expect(auth.confirmPhone(googleUser.toString(), '+263771111111', '123456')).rejects.toMatchObject({ statusCode: 409 });
  expect((await User.findById(googleUser).lean())?.phone).toBe('firebase:abc');
});

it('a recently closed number brings no new-user perks', async () => {
  await rememberClosedPhone('+263773333333', new Date());
  await auth.sendPhoneCode(googleUser.toString(), '+263773333333');
  const user = await auth.confirmPhone(googleUser.toString(), '+263773333333', '123456');
  expect(user.newUserPerksUsed).toBe(true);
});
