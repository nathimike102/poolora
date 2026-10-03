/**
 * VerifiedEmail.ts
 *
 * An email address is unique to one account, and anyone can type any
 * address into their profile. So an address is only trusted once its owner
 * has proved it (`emailVerifiedAt`), and the owner of a verified address
 * always gets it: an account that only typed it in loses it.
 */

import { Types } from 'mongoose';
import { User } from '../models/User';
import { logger } from '../utils/logger';

/** Frees a verified address from any other account that only typed it in */
export async function takeVerifiedEmail(email: string, ownerId?: Types.ObjectId): Promise<void> {
  const freed = await User.updateMany(
    { email, emailVerifiedAt: { $exists: false }, ...(ownerId ? { _id: { $ne: ownerId } } : {}) },
    { $unset: { email: 1 } },
  );
  if (freed.modifiedCount) logger.info('Freed a verified email from an account that had not verified it', { accounts: freed.modifiedCount });
}

/**
 * Puts a verified address on this account, taking it from any account that
 * only typed it in. Returns false, changing nothing, if another account has
 * already proved the same address.
 */
export async function giveVerifiedEmail(userId: Types.ObjectId, email: string): Promise<boolean> {
  if (await User.exists({ email, emailVerifiedAt: { $exists: true }, _id: { $ne: userId } })) return false;
  await takeVerifiedEmail(email, userId);
  try {
    await User.updateOne({ _id: userId }, { $set: { email, emailVerifiedAt: new Date() } });
    return true;
  } catch (error) {
    // Another sign-in proved it at the same moment
    if ((error as { code?: number }).code === 11000) return false;
    throw error;
  }
}
