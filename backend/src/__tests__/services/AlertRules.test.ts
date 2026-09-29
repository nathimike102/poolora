/**
 * Admin alert rules (UC-A02, UC-A06) against a real MongoDB: validation,
 * firing once per cooldown, paging for every new SOS, and email and SMS to
 * the chosen admins only.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const sendMail = jest.fn().mockResolvedValue(true);
jest.mock('../../services/Mailer', () => ({
  ...jest.requireActual('../../services/Mailer'),
  sendMail: (...a: unknown[]) => sendMail(...a),
  mailEnabled: () => true,
}));
const sendSMS = jest.fn().mockResolvedValue(undefined);
jest.mock('../../services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({ sendSMS: (...a: unknown[]) => sendSMS(...a) })),
}));

import { User } from '../../models/User';
import { AlertRule } from '../../models/AlertRule';
import { EmergencyRecord } from '../../models/EmergencyRecord';
import { AlertRuleService } from '../../services/AlertRuleService';
import { config } from '../../config';

jest.setTimeout(60_000);
let mongo: MongoMemoryServer;
const service = new AlertRuleService();
const admin = new Types.ObjectId();
const rider = new Types.ObjectId();
const sos = (createdAt = new Date()) => EmergencyRecord.collection.insertOne({ triggeredBy: rider, status: 'triggered', riskLevel: 'high', createdAt });

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  (config.twilio as { enabled: boolean }).enabled = true;
});
afterAll(async () => {
  (config.twilio as { enabled: boolean }).enabled = false;
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  await mongoose.connection.db!.dropDatabase();
  sendMail.mockClear();
  sendSMS.mockClear();
  await User.collection.insertMany([
    { _id: admin, name: 'On-call admin', phone: '+919000000009', email: 'oncall@poolora.app', capabilities: ['rider', 'admin'], kyc: { status: 'none' }, stats: {} },
    { _id: rider, name: 'Rider', phone: '+919000000001', capabilities: ['rider'], kyc: { status: 'none' }, stats: {} },
  ]);
});

it('only sends alerts to admins', async () => {
  const base = { name: 'Open SOS', metric: 'active_sos', comparator: 'above', threshold: 0 };
  await expect(service.create({ ...base, recipients: [rider.toString()] }, admin.toString())).rejects.toThrow('only go to admins');
  await expect(service.create({ ...base, metric: 'nope', recipients: [admin.toString()] }, admin.toString())).rejects.toThrow('what to watch');
});

it('fires once, then stays quiet for the cooldown', async () => {
  const { rule } = await service.create({ name: 'Open SOS', metric: 'active_sos', comparator: 'above', threshold: 0, channels: { email: true, sms: true }, recipients: [admin.toString()] }, admin.toString());
  expect(await service.check()).toBe(0);
  await sos();
  expect(await service.check()).toBe(1);
  expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'oncall@poolora.app', subject: 'Poolora alert: Open SOS' }));
  expect(sendSMS).toHaveBeenCalledWith('+919000000009', expect.stringContaining('Open SOS alerts is 1, above the limit of 0'));
  expect(await service.check()).toBe(0); // still 1, but inside the cooldown
  expect((await AlertRule.findById(rule._id).lean())?.history).toHaveLength(1);
  expect(await service.firing()).toHaveLength(1);
});

it('pages for every new SOS, even inside the cooldown', async () => {
  await service.create({ name: 'Every SOS', metric: 'new_sos', comparator: 'above', threshold: 0, channels: { email: false, sms: true }, recipients: [admin.toString()] }, admin.toString());
  const t0 = Date.now();
  await service.check(new Date(t0)); // sets the starting point
  await sos(new Date(t0 + 30_000));
  expect(await service.check(new Date(t0 + 60_000))).toBe(1);
  await sos(new Date(t0 + 90_000));
  expect(await service.check(new Date(t0 + 120_000))).toBe(1);
  expect(await service.check(new Date(t0 + 180_000))).toBe(0); // nothing new
  expect(sendSMS).toHaveBeenCalledTimes(2);
});
