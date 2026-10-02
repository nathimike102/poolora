/**
 * Signing in with Firebase links an existing account by email only when
 * Firebase has verified the address. Otherwise anyone could make a Firebase
 * email-and-password account with an admin's address and sign in as them.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
jest.mock('../../config/firebase', () => ({ getFirebaseAuth: jest.fn() }));

import { User } from '../../models/User';
import { FirebaseAuthStrategy } from '../../auth/strategies/FirebaseAuthStrategy';

jest.setTimeout(60_000);

let mongo: MongoMemoryServer;
const adminId = new Types.ObjectId();
const sync = (claims: Record<string, unknown>) =>
  (new FirebaseAuthStrategy() as unknown as { syncUser: (d: unknown) => Promise<{ _id: Types.ObjectId; email?: string }> }).syncUser({ uid: `uid-${Math.random()}`, ...claims });

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await User.init();
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  await User.deleteMany({});
  await User.collection.insertOne({ _id: adminId, name: 'Admin', phone: '+263771000009', email: 'admin@poolora.co.zw', capabilities: ['rider', 'admin'], isActive: true, stats: {} });
});

describe('linking a Firebase sign-in by email', () => {
  it('links to the account when the email is verified', async () => {
    const user = await sync({ email: 'admin@poolora.co.zw', email_verified: true });
    expect(String(user._id)).toBe(String(adminId));
  });

  it('refuses an unverified email that belongs to an account', async () => {
    await expect(sync({ email: 'Admin@Poolora.co.zw', email_verified: false })).rejects.toThrow('Verify this email address');
    expect((await User.findById(adminId).lean())?.firebaseUid).toBeUndefined();
  });

  it('creates a new account for an unverified email without claiming the address', async () => {
    const user = await sync({ email: 'someone@example.com', email_verified: false });
    expect(String(user._id)).not.toBe(String(adminId));
    expect(user.email).toBeUndefined();
  });
});
