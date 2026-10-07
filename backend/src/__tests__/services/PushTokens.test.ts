/**
 * Each phone registers its push token; a token follows the account signed in
 * on that phone, and an account keeps its five most recent phones.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { User } from '../../models/User';
import { MAX_PUSH_TOKENS, registerPushToken, removePushToken } from '../../services/PushTokens';

jest.setTimeout(60_000);

let mongo: MongoMemoryServer;
const alice = new Types.ObjectId();
const bob = new Types.ObjectId();
const tokens = async (id: Types.ObjectId) => (await User.findById(id).lean())?.fcmTokens;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await User.collection.insertMany([
    { _id: alice, name: 'Alice', phone: '+263771111111', fcmTokens: [] },
    { _id: bob, name: 'Bob', phone: '+263772222222', fcmTokens: [] },
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

it('saves a token once, however often the phone registers it', async () => {
  await registerPushToken(alice.toString(), 'phone-a-token-0000000001');
  await registerPushToken(alice.toString(), 'phone-a-token-0000000001');
  expect(await tokens(alice)).toEqual(['phone-a-token-0000000001']);
});

it('moves a token to whoever signs in on that phone next', async () => {
  await registerPushToken(bob.toString(), 'phone-a-token-0000000001');
  expect(await tokens(alice)).toEqual([]);
  expect(await tokens(bob)).toEqual(['phone-a-token-0000000001']);
});

it('keeps the most recent phones only', async () => {
  for (let i = 0; i < MAX_PUSH_TOKENS + 2; i++) await registerPushToken(alice.toString(), `alice-phone-token-${i}-000000`);
  const kept = await tokens(alice);
  expect(kept).toHaveLength(MAX_PUSH_TOKENS);
  expect(kept?.[kept.length - 1]).toBe(`alice-phone-token-${MAX_PUSH_TOKENS + 1}-000000`);
});

it('forgets the phone on sign-out', async () => {
  await removePushToken(bob.toString(), 'phone-a-token-0000000001');
  expect(await tokens(bob)).toEqual([]);
});
