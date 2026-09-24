/**
 * Help and support tickets (UC-X02): users open requests in a category,
 * safety and payment ones are urgent, and the team replies in the thread.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mockNotify = jest.fn().mockResolvedValue(undefined);
jest.mock('../../services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({ createNotification: mockNotify, sendPushNotification: jest.fn().mockResolvedValue(undefined) })),
}));
jest.mock('../../services/Mailer', () => ({ emailUser: jest.fn().mockResolvedValue(undefined) }));
const mockEmit = jest.fn();
jest.mock('../../sockets/SocketGateway', () => ({
  SocketGateway: { getInstance: () => ({ getIO: () => ({ to: () => ({ emit: mockEmit }) }) }) },
}));

import { SupportService } from '../../services/SupportService';
import { AdminAuditLog } from '../../models/AdminAuditLog';
import '../../models/User';

jest.setTimeout(60_000);

let mongo: MongoMemoryServer;
const service = new SupportService();
const userId = new Types.ObjectId().toString();
const otherId = new Types.ObjectId().toString();
const adminId = new Types.ObjectId().toString();

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
  jest.clearAllMocks();
});

it('puts safety and payment requests first and alerts admins about safety', async () => {
  await service.create(userId, { category: 'feedback', subject: 'Love it', message: 'Great app, thanks a lot' });
  await service.create(userId, { category: 'safety', subject: 'Driver was rude', message: 'He shouted at me at the drop' });
  expect(mockEmit).toHaveBeenCalledWith('support:safety', expect.objectContaining({ userId }));
  const { tickets } = await service.queue('open');
  expect(tickets.map((t) => [t.category, t.priority])).toEqual([['safety', 'urgent'], ['feedback', 'normal']]);
});

it('threads replies, notifies the user and reopens when they answer', async () => {
  const t = await service.create(userId, { category: 'payment', subject: 'Charged twice', message: 'I see two debits for one trip' });
  await service.adminReply(t._id.toString(), adminId, 'We refunded the second charge.', true);
  expect(mockNotify).toHaveBeenCalledWith(userId, 'Reply to "Charged twice"', 'We refunded the second charge.', 'system', expect.anything());
  expect((await service.get(userId, t._id.toString())).status).toBe('closed');

  const reopened = await service.reply(userId, t._id.toString(), 'It has not arrived yet');
  expect(reopened.status).toBe('open');
  expect(reopened.messages.map((m) => m.from)).toEqual(['user', 'support', 'user']);
  expect(await AdminAuditLog.countDocuments({ action: 'support.reply_close', targetId: t._id.toString() })).toBe(1);
});

it('keeps tickets private to their owner and limits open ones', async () => {
  const t = await service.create(userId, { category: 'technical', subject: 'Map blank', message: 'The map shows nothing at all' });
  await expect(service.get(otherId, t._id.toString())).rejects.toThrow('not found');
  await expect(service.reply(otherId, t._id.toString(), 'hi')).rejects.toThrow('not found');
  for (let i = 0; i < 4; i++) await service.create(userId, { category: 'feedback', subject: `Idea ${i}`, message: 'Please add dark mode' });
  await expect(service.create(userId, { category: 'feedback', subject: 'One more', message: 'Another idea here' })).rejects.toMatchObject({ errorId: 'TOO_MANY_TICKETS' });
});
