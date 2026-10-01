/**
 * Rating a trip (UC-R06): category scores, a 7-day window, private problem
 * reports with a safety alert, reviews public only after approval, and one
 * reminder a day after the trip.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
const mockPush = jest.fn().mockResolvedValue(undefined);
jest.mock('../../services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    createNotification: jest.fn().mockResolvedValue(undefined),
    sendPushNotification: mockPush,
  })),
}));
const mockEmit = jest.fn();
jest.mock('../../sockets/SocketGateway', () => ({
  SocketGateway: { getInstance: () => ({ getIO: () => ({ to: () => ({ emit: mockEmit }) }) }) },
}));

import { User } from '../../models/User';
import { Booking } from '../../models/Booking';
import { Rating } from '../../models/Rating';
import { RatingService } from '../../services/RatingService';

jest.setTimeout(60_000);

const DAY = 86_400_000;
let mongo: MongoMemoryServer;
const service = new RatingService();
const riderId = new Types.ObjectId();
const driverId = new Types.ObjectId();
const adminId = new Types.ObjectId().toString();

async function completedBooking(daysAgo: number) {
  const _id = new Types.ObjectId();
  const place = { location: { type: 'Point', coordinates: [77.6, 12.97] }, address: 'Indiranagar, Bengaluru' };
  await Booking.collection.insertOne({
    _id, ride: new Types.ObjectId(), rider: riderId, driver: driverId, status: 'completed', seatsBooked: 1,
    pickup: place, dropoff: { ...place, address: 'Marathahalli, Bengaluru' },
    actualDropoffTime: new Date(Date.now() - daysAgo * DAY), createdAt: new Date(), updatedAt: new Date(),
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
beforeEach(async () => {
  await mongoose.connection.db!.dropDatabase();
  jest.clearAllMocks();
  await User.collection.insertMany([
    { _id: riderId, name: 'Asha Rao', phone: '+919000000001', capabilities: ['rider'], kyc: { status: 'none' }, stats: {} },
    { _id: driverId, name: 'Ravi Kumar', phone: '+919000000002', capabilities: ['rider', 'driver'], kyc: { status: 'approved' }, stats: {} },
  ]);
});

it('stores category scores, counts the score at once and summarises them', async () => {
  const bookingId = await completedBooking(1);
  await service.createRating(riderId.toString(), { bookingId, score: 4, categories: { behavior: 5, cleanliness: 3, punctuality: 4 } });
  expect((await User.findById(driverId).lean())?.stats).toMatchObject({ avgRatingAsDriver: 4, totalRatingsAsDriver: 1 });
  expect(await service.summary(driverId.toString(), 'driver')).toEqual({
    count: 1, overall: 4, categories: { behavior: 5, cleanliness: 3, punctuality: 4 },
  });
});

it('closes 7 days after the trip', async () => {
  const bookingId = await completedBooking(8);
  await expect(service.createRating(riderId.toString(), { bookingId, score: 5 })).rejects.toMatchObject({ errorId: 'RATING_WINDOW_CLOSED' });
});

it('shows a review only after an admin approves it', async () => {
  const bookingId = await completedBooking(1);
  const rating = await service.createRating(riderId.toString(), { bookingId, score: 5, comment: 'Smooth ride, great music' });
  expect(rating.commentStatus).toBe('pending');
  let { ratings } = await service.getUserRatings(driverId.toString(), 1, 10);
  expect(ratings[0].comment).toBeUndefined();

  await service.moderate(rating._id.toString(), adminId, 'approve');
  ({ ratings } = await service.getUserRatings(driverId.toString(), 1, 10));
  expect(ratings[0].comment).toBe('Smooth ride, great music');
  await expect(service.moderate(rating._id.toString(), adminId, 'reject')).rejects.toMatchObject({ statusCode: 409 });
});

it('keeps reported problems private and alerts admins about safety at once, ahead of other reviews', async () => {
  const first = await completedBooking(2);
  await service.createRating(riderId.toString(), { bookingId: first, score: 4, comment: 'Fine' });
  const second = await completedBooking(1);
  await service.createRating(riderId.toString(), { bookingId: second, score: 1, issues: ['safety'], issueDetails: 'Driver was on the phone at speed' });

  expect(mockEmit).toHaveBeenCalledWith('rating:safety', expect.objectContaining({ bookingId: second }));
  const { ratings } = await service.getUserRatings(driverId.toString(), 1, 10);
  expect(JSON.stringify(ratings)).not.toContain('on the phone');
  const queue = await service.moderationQueue('pending');
  expect(queue.ratings.map((r) => r.booking.toString())).toEqual([second, first]);
});

it('keeps "did you feel safe?" confidential, averages it apart, and treats "no" as a safety report', async () => {
  await User.collection.insertOne({ _id: new Types.ObjectId(adminId), name: 'Admin', phone: '+263771000009', capabilities: ['rider', 'admin'], stats: {} });
  const first = await completedBooking(1);
  const second = await completedBooking(1);
  await service.createRating(riderId.toString(), { bookingId: first, score: 5, safety: 5 });
  await service.createRating(riderId.toString(), { bookingId: second, score: 4, safety: 1 });

  const { ratings } = await service.getUserRatings(driverId.toString(), 1, 10);
  expect(ratings.every((r) => (r as { safety?: number }).safety === undefined)).toBe(true);
  const publicDriver = await User.findById(driverId).lean();
  expect(publicDriver).not.toHaveProperty('safetyRating');
  const withSafety = await User.findById(driverId).select('+safetyRating').lean();
  expect(withSafety?.safetyRating?.asDriver).toEqual({ avg: 3, count: 2 });

  expect(mockEmit).toHaveBeenCalledWith('rating:safety', expect.objectContaining({ bookingId: second }));
  expect(mockPush).toHaveBeenCalledWith(adminId, 'Safety report', expect.stringContaining('did not feel safe'), expect.objectContaining({ type: 'safety_report' }));
  const reported = await service.moderationQueue('reported');
  expect(reported.ratings.map((r) => String(r.booking))).toEqual([second]);
  const pending = await service.moderationQueue('pending');
  expect(String(pending.ratings[0].booking)).toBe(second);
});

it('lists trips still to rate, and reminds once a day after the trip', async () => {
  const unrated = await completedBooking(1.5);
  const rated = await completedBooking(2);
  await completedBooking(0.5); // too soon for a reminder
  await service.createRating(riderId.toString(), { bookingId: rated, score: 5 });

  const pending = await service.pending(riderId.toString());
  expect(pending.map((p) => p.bookingId)).not.toContain(rated);
  expect(pending.find((p) => p.bookingId === unrated)).toMatchObject({ role: 'rider', rateeName: 'Ravi Kumar' });

  expect(await service.sendReminders()).toBe(1);
  expect(mockPush).toHaveBeenCalledWith(riderId.toString(), 'How was your ride with Ravi?', expect.any(String), expect.objectContaining({ bookingId: unrated }));
  expect(await service.sendReminders()).toBe(0);
  expect(await Rating.countDocuments()).toBe(1);
});
