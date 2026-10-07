/**
 * The phones that get a person's push notifications: each signed-in copy of the
 * app registers its Firebase token, and removes it on sign-out.
 */
import { User } from '../models/User';

/** Phones per account; the oldest drops off past this */
export const MAX_PUSH_TOKENS = 5;

/**
 * Saves this phone's token for the user, newest last. A token belongs to one
 * phone, so it is taken off any other account first: otherwise someone signing
 * in on a phone another account used would get that account's notifications.
 */
export async function registerPushToken(userId: string, token: string): Promise<void> {
  await User.updateMany({ _id: { $ne: userId }, fcmTokens: token }, { $pull: { fcmTokens: token } });
  await User.updateOne({ _id: userId }, { $pull: { fcmTokens: token } });
  await User.updateOne({ _id: userId }, { $push: { fcmTokens: { $each: [token], $slice: -MAX_PUSH_TOKENS } } });
}

/** Signing out: this phone stops getting the user's notifications */
export async function removePushToken(userId: string, token: string): Promise<void> {
  await User.updateOne({ _id: userId }, { $pull: { fcmTokens: token } });
}
