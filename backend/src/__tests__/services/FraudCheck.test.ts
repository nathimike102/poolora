/**
 * Fraud checks on failed payments (UC-AI02): high risk flags the account for
 * review, critical risk suspends it until an admin looks. The check never
 * blocks an account by itself, because a block needs two admins (UC-A05 3b).
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mockPost = jest.fn();
jest.mock('../../utils/mlClient', () => ({ mlClient: { post: (...a: unknown[]) => mockPost(...a) } }));
const mockEmit = jest.fn();
jest.mock('../../sockets/SocketGateway', () => ({
  SocketGateway: { getInstance: () => ({ getIO: () => ({ to: () => ({ emit: mockEmit }) }) }) },
}));
jest.mock('../../services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({ createNotification: jest.fn().mockResolvedValue(undefined) })),
}));

import { User } from '../../models/User';
import { FraudDetectionService } from '../../services/FraudDetectionService';

jest.setTimeout(60_000);

let mongo: MongoMemoryServer;
const service = new FraudDetectionService();

async function makeUser(extra: Record<string, unknown> = {}) {
  const _id = new Types.ObjectId();
  await User.collection.insertOne({
    _id, name: 'Asha', phone: `+9190000${Math.floor(Math.random() * 1e5)}`, capabilities: ['rider'], kyc: { status: 'none' }, stats: {},
    fraudLevel: 'clear', isBlocked: false, isSuspended: false, createdAt: new Date(), ...extra,
  });
  return _id.toString();
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(() => {
  mockPost.mockReset();
  mockEmit.mockReset();
});

it('flags high risk for review and alerts admins', async () => {
  const id = await makeUser();
  mockPost.mockResolvedValue({ data: { risk_level: 'high', risk_score: 60, flags: ['Card testing'], should_block: false } });
  await service.analyzePaymentFailure(id, { amount: 100 });
  const u = await User.findById(id).lean();
  expect(u).toMatchObject({ fraudLevel: 'flagged', fraudFlags: ['Card testing'], isSuspended: false, isBlocked: false });
  expect(mockEmit).toHaveBeenCalledWith('fraud:flagged', expect.objectContaining({ userId: id, action: 'flagged' }));
});

it('suspends critical risk until reviewed, and never blocks', async () => {
  const id = await makeUser();
  mockPost.mockResolvedValue({ data: { risk_level: 'critical', risk_score: 90, flags: ['High booking velocity'], should_block: true } });
  await service.analyzePaymentFailure(id, { amount: 100 });
  const u = await User.findById(id).lean();
  expect(u).toMatchObject({ fraudLevel: 'blocked', isSuspended: true, isBlocked: false });
  expect(u?.suspensionReason).toMatch(/^Automatic fraud check: High booking velocity/);
  expect(u?.suspendedUntil).toBeUndefined();
});

it('leaves an admin suspension as it is', async () => {
  const until = new Date(Date.now() + 7 * 86_400_000);
  const id = await makeUser({ isSuspended: true, suspendedUntil: until, suspensionReason: 'Rude to riders' });
  mockPost.mockResolvedValue({ data: { risk_level: 'critical', flags: ['x'], should_block: true } });
  await service.analyzePaymentFailure(id, { amount: 100 });
  const u = await User.findById(id).lean();
  expect(u?.suspensionReason).toBe('Rude to riders');
  expect(u?.suspendedUntil?.getTime()).toBe(until.getTime());
  expect(u?.fraudLevel).toBe('blocked');
});

it('falls back to local rules when the ML service is down', async () => {
  const id = await makeUser();
  mockPost.mockRejectedValue(new Error('down'));
  const result = await service.analyzePaymentFailure(id, { amount: 100 });
  expect(result.riskLevel).toBe('low');
  expect((await User.findById(id).lean())?.fraudLevel).toBe('clear');
});
