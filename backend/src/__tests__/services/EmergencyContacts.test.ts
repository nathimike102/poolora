/**
 * Emergency contacts (UC-R10): up to three, one primary, a choice of who
 * gets the SOS text, and verification by a link in a text message.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mockSms = jest.fn().mockResolvedValue(undefined);
let smsOn = true;
jest.mock('../../services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    smsAvailable: () => smsOn,
    sendSMS: mockSms,
    createNotification: jest.fn().mockResolvedValue(undefined),
    sendPushNotification: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { User } from '../../models/User';
import { EmergencyContactService } from '../../services/EmergencyContactService';

jest.setTimeout(60_000);

let mongo: MongoMemoryServer;
const service = new EmergencyContactService();
const userId = new Types.ObjectId();
const mom = { name: 'Lakshmi', phone: '+919811111111', relation: 'Mother' };
const brother = { name: 'Arun', phone: '+919822222222', relation: 'Brother', primary: true };

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
  mockSms.mockClear();
  smsOn = true;
  await User.collection.insertOne({ _id: userId, name: 'Asha Rao', phone: '+919000000001', capabilities: ['rider'], kyc: { status: 'none' }, stats: {}, emergencyContacts: [] });
});

function tokenFromLastSms(): string {
  const text: string = mockSms.mock.calls.at(-1)[1];
  return text.split('/track/contact/')[1];
}

it('keeps exactly one primary contact', async () => {
  const saved = await service.replace(userId.toString(), [mom, brother]);
  expect(saved.map((c) => c.primary)).toEqual([false, true]);
  const none = await service.replace(userId.toString(), [mom, { ...brother, primary: false }]);
  expect(none.map((c) => c.primary)).toEqual([true, false]);
});

it('refuses more than three contacts and duplicate numbers', async () => {
  const four = [1, 2, 3, 4].map((n) => ({ name: `C${n}`, phone: `+91980000000${n}`, relation: 'Friend' }));
  await expect(service.replace(userId.toString(), four)).rejects.toThrow('up to 3');
  await expect(service.replace(userId.toString(), [mom, { ...mom, name: 'Other' }])).rejects.toThrow('different phone');
});

it('verifies a contact by the link in the text, and keeps it verified across edits', async () => {
  const [saved] = await service.replace(userId.toString(), [mom]);
  await service.sendVerification(userId.toString(), saved._id!);
  expect(mockSms).toHaveBeenCalledWith(mom.phone, expect.stringContaining('Asha added you as an emergency contact'));
  const token = tokenFromLastSms();

  // Opening the page changes nothing; confirming does
  expect(await service.peek(token)).toEqual({ userFirstName: 'Asha', contactName: 'Lakshmi', verified: false });
  expect((await service.list(userId.toString()))[0].verified).toBe(false);
  await service.confirm(token);
  expect((await service.list(userId.toString()))[0].verified).toBe(true);

  // Renamed, same number: still verified. New number: not verified
  const renamed = await service.replace(userId.toString(), [{ ...mom, name: 'Amma' }]);
  expect(renamed[0]).toMatchObject({ name: 'Amma', verified: true });
  const changed = await service.replace(userId.toString(), [{ ...mom, phone: '+919833333333' }]);
  expect(changed[0].verified).toBe(false);
});

it('never exposes the token hash', async () => {
  const [saved] = await service.replace(userId.toString(), [mom]);
  await service.sendVerification(userId.toString(), saved._id!);
  const user = await User.findById(userId).lean();
  expect(user?.emergencyContacts[0].verifyTokenHash).toBeUndefined();
  expect(JSON.stringify(await service.list(userId.toString()))).not.toContain('verifyTokenHash');
});

it('limits resends and reports when SMS is off', async () => {
  const [saved] = await service.replace(userId.toString(), [mom]);
  await service.sendVerification(userId.toString(), saved._id!);
  await expect(service.sendVerification(userId.toString(), saved._id!)).rejects.toMatchObject({ errorId: 'VERIFY_RATE_LIMITED' });

  smsOn = false;
  const [other] = await service.replace(userId.toString(), [brother]);
  await expect(service.sendVerification(userId.toString(), other._id!)).rejects.toMatchObject({ errorId: 'SMS_UNAVAILABLE' });
});

it('rejects unknown and malformed tokens', async () => {
  expect(await service.peek('not-a-token')).toBeNull();
  expect(await service.confirm('A'.repeat(32))).toBeNull();
});

it('gives ids to contacts saved before contacts had them', async () => {
  await User.collection.updateOne({ _id: userId }, { $set: { emergencyContacts: [{ name: 'Old', phone: '+919844444444', relation: 'Friend' }] } });
  const [c] = await service.list(userId.toString());
  expect(c._id).toMatch(/^[0-9a-f]{24}$/);
  expect(c).toMatchObject({ primary: false, notifyOnSos: true, verified: false });
  expect((await service.list(userId.toString()))[0]._id).toBe(c._id);
});
