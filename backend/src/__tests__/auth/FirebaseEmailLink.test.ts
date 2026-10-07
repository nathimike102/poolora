/**
 * Signing in with Firebase links an existing account by email only when
 * Firebase has verified the address and that account proved it too.
 * Otherwise anyone could make a Firebase email-and-password account with an
 * admin's address and sign in as them, or type someone's address into their
 * own profile and have that person's sign-in land in their account.
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
  (new FirebaseAuthStrategy() as unknown as { syncUser: (d: unknown) => Promise<{ _id: Types.ObjectId; email?: string; emailVerifiedAt?: Date }> }).syncUser({ uid: `uid-${Math.random()}`, ...claims });

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
  await User.collection.insertOne({ _id: adminId, name: 'Admin', phone: '+263771000009', email: 'admin@siham.co.zw', emailVerifiedAt: new Date(), capabilities: ['rider', 'admin'], isActive: true, stats: {} });
});

describe('linking a Firebase sign-in by email', () => {
  it('links to the account when the email is verified', async () => {
    const user = await sync({ email: 'admin@siham.co.zw', email_verified: true });
    expect(String(user._id)).toBe(String(adminId));
  });

  it('refuses an unverified email that belongs to an account', async () => {
    await expect(sync({ email: 'Admin@Siham.co.zw', email_verified: false })).rejects.toThrow('Verify this email address');
    expect((await User.findById(adminId).lean())?.firebaseUid).toBeUndefined();
  });

  it('creates a new account for an unverified email without claiming the address', async () => {
    const user = await sync({ email: 'someone@example.com', email_verified: false });
    expect(String(user._id)).not.toBe(String(adminId));
    expect(user.email).toBeUndefined();
  });

  it('never links into an account that only typed the address in, and gives the owner the address', async () => {
    // An attacker signs up by phone and types Tendai's address into their profile
    const attacker = new Types.ObjectId();
    await User.collection.insertOne({ _id: attacker, name: 'Attacker', phone: '+263771000666', email: 'tendai@gmail.com', capabilities: ['rider'], isActive: true, stats: {} });
    const tendai = await sync({ email: 'tendai@gmail.com', email_verified: true });
    expect(String(tendai._id)).not.toBe(String(attacker));
    expect(tendai.email).toBe('tendai@gmail.com');
    expect(tendai.emailVerifiedAt).toBeInstanceOf(Date);
    const after = await User.findById(attacker).lean();
    expect(after?.email).toBeUndefined();
    expect(after?.firebaseUid).toBeUndefined();
  });

  it('gives the address to an account made before it was verified, once it is', async () => {
    const uid = 'uid-later';
    const first = await (new FirebaseAuthStrategy() as unknown as { syncUser: (d: unknown) => Promise<{ _id: Types.ObjectId; email?: string }> }).syncUser({ uid, email: 'rudo@example.com', email_verified: false });
    expect(first.email).toBeUndefined();
    await (new FirebaseAuthStrategy() as unknown as { syncUser: (d: unknown) => Promise<unknown> }).syncUser({ uid, email: 'rudo@example.com', email_verified: true });
    expect(await User.findById(first._id).lean()).toMatchObject({ email: 'rudo@example.com', emailVerifiedAt: expect.any(Date) });
  });
});

describe('changing the address in the profile', () => {
  it('is no longer verified', async () => {
    const { UserController } = await import('../../controllers/UserController');
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await UserController.updateMe({ user: { userId: String(adminId) }, body: { email: 'new@siham.co.zw' } } as never, res as never, next);
    expect(next).not.toHaveBeenCalled();
    const after = await User.findById(adminId).lean();
    expect(after?.email).toBe('new@siham.co.zw');
    expect(after?.emailVerifiedAt).toBeUndefined();

    // Saving the same address again changes nothing
    await User.updateOne({ _id: adminId }, { $set: { emailVerifiedAt: new Date() } });
    await UserController.updateMe({ user: { userId: String(adminId) }, body: { email: 'New@Siham.co.zw' } } as never, res as never, next);
    expect((await User.findById(adminId).lean())?.emailVerifiedAt).toBeInstanceOf(Date);
  });
});

