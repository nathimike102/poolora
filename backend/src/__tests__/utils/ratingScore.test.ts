/**
 * The shown rating: starts at 5, never above 5, and one bad rating cannot
 * sink someone while a pattern of them still shows.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { User } from '../../models/User';
import { addRatingPipeline, backfillRatingScores, plainAverage, ratingScore, ratingSum } from '../../utils/ratingScore';

jest.setTimeout(60_000);

describe('ratingScore', () => {
  it('starts everyone at 5 stars', () => {
    expect(ratingScore(0, 0)).toBe(5);
  });

  it('never goes above 5', () => {
    expect(ratingScore(5 * 200, 200)).toBe(5);
  });

  it('lets one unhappy person dent a new account, not sink it', () => {
    expect(ratingScore(1, 1)).toBe(4.64);
  });

  it('dents a long good record even less', () => {
    expect(ratingScore(50 * 5 + 1, 51)).toBe(4.93);
  });

  it('still shows a pattern of low ratings', () => {
    expect(ratingScore(40, 40)).toBeLessThan(2);
  });

  it('works out the sum for accounts rated before sums were kept', () => {
    expect(ratingSum({ avgRatingAsDriver: 4.5, totalRatingsAsDriver: 4 }, 'Driver')).toBe(18);
    expect(ratingSum({ avgRatingAsDriver: 4.91, totalRatingsAsDriver: 1, ratingSumAsDriver: 4 }, 'Driver')).toBe(4);
    expect(plainAverage({ avgRatingAsDriver: 4.91, totalRatingsAsDriver: 1, ratingSumAsDriver: 4 }, 'Driver')).toBe(4);
    expect(plainAverage({}, 'Driver')).toBe(0);
  });
});

describe('addRatingPipeline', () => {
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('adds ratings on the server, including ones that arrive together', async () => {
    const _id = new Types.ObjectId();
    await User.collection.insertOne({ _id, name: 'New Driver', phone: '+263770000001', stats: {} });
    await Promise.all([3, 5, 4].map((score) => User.updateOne({ _id }, addRatingPipeline('Driver', score))));
    const stats = (await User.findById(_id).lean())?.stats;
    expect(stats).toMatchObject({ totalRatingsAsDriver: 3, ratingSumAsDriver: 12, avgRatingAsDriver: ratingScore(12, 3) });
  });

  it('carries on from the average of an account rated before sums were kept', async () => {
    const _id = new Types.ObjectId();
    await User.collection.insertOne({ _id, name: 'Old Driver', phone: '+263770000002', stats: { avgRatingAsDriver: 4.5, totalRatingsAsDriver: 4 } });
    await User.updateOne({ _id }, addRatingPipeline('Driver', 5));
    const stats = (await User.findById(_id).lean())?.stats;
    expect(stats).toMatchObject({ totalRatingsAsDriver: 5, ratingSumAsDriver: 23, avgRatingAsDriver: ratingScore(23, 5) });
  });

  it('moves old accounts to the score once, and starts unrated ones at 5', async () => {
    const rated = new Types.ObjectId();
    const unrated = new Types.ObjectId();
    await User.collection.insertMany([
      { _id: rated, name: 'Rated Rider', phone: '+263770000003', stats: { avgRatingAsRider: 4, totalRatingsAsRider: 2 } },
      { _id: unrated, name: 'Unrated Rider', phone: '+263770000004', stats: { avgRatingAsRider: 0, totalRatingsAsRider: 0 } },
    ]);
    await backfillRatingScores();
    await backfillRatingScores();
    expect((await User.findById(rated).lean())?.stats).toMatchObject({ avgRatingAsRider: ratingScore(8, 2), ratingSumAsRider: 8 });
    expect((await User.findById(unrated).lean())?.stats).toMatchObject({ avgRatingAsRider: 5, ratingSumAsRider: 0 });
  });
});
