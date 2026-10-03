import type { DecodedIdToken } from 'firebase-admin/auth';
import { AuthStrategy, AuthResult, AuthProvider } from '../AuthStrategy';
import { getFirebaseAuth } from '../../config/firebase';
import { User, IUser } from '../../models/User';
import { UserCapability } from '../../types';
import { AuthenticationError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { EventBridge } from '../../events';
import { errorCode } from '../../utils/errors';
import { giveVerifiedEmail, takeVerifiedEmail } from '../../services/VerifiedEmail';

/**
 * Verifies Firebase ID tokens and synchronizes the user into the local database.
 *
 * Flow:
 *   1. getAuth().verifyIdToken(token)
 *   2. Look up the user by firebaseUid  (fast path)
 *   3. Fall back to look-up by phone / email (linking path)
 *   4. Create a brand-new user if neither matches (registration path)
 */
export class FirebaseAuthStrategy implements AuthStrategy {
  async authenticate(token: string): Promise<AuthResult> {
    let decoded: DecodedIdToken;

    try {
      decoded = await getFirebaseAuth().verifyIdToken(token, true /* checkRevoked */);
    } catch (err) {
      const code = errorCode(err) ?? '';
      if (code === 'auth/id-token-expired') {
        throw new AuthenticationError('Firebase token has expired');
      }
      if (code === 'auth/id-token-revoked') {
        throw new AuthenticationError('Firebase token has been revoked');
      }
      if (code === 'auth/argument-error') {
        throw new AuthenticationError('Malformed Firebase token');
      }
      // Any other Firebase error: let the caller try the fallback
      throw new AuthenticationError('Firebase token verification failed');
    }

    const user = await this.syncUser(decoded);
    return { user, provider: AuthProvider.FIREBASE };
  }

  // ─── User Synchronization ───────────────────────────────────────────────

  private async syncUser(decoded: DecodedIdToken): Promise<IUser> {
    const { uid, phone_number: phone, name, picture } = decoded;
    // An email is trusted only once Firebase has verified it: anyone can make a
    // Firebase email-and-password account with someone else's address, and
    // linking on it would hand them that person's account (an admin's included)
    const claimed = decoded.email?.toLowerCase();
    const email = claimed && decoded.email_verified === true ? claimed : undefined;

    // 1. Fast path — user already linked
    let user = await User.findOne({ firebaseUid: uid, isActive: true });
    if (user) {
      // Their sign-in proves the address: on their account, or for an account
      // made before they verified it, which has none
      if (email && !user.emailVerifiedAt && (!user.email || user.email === email) && (await giveVerifiedEmail(user._id, email))) {
        user.email = email;
        user.emailVerifiedAt = new Date();
      }
      return user;
    }

    // 2. Try matching by phone (most people here sign in by phone)
    if (phone) {
      user = await User.findOne({ phone, isActive: true });
      if (user) {
        user.firebaseUid = uid;
        if (picture && !user.profilePhotoUrl) user.profilePhotoUrl = picture;
        await user.save();
        if (email && !user.emailVerifiedAt && (!user.email || user.email === email) && (await giveVerifiedEmail(user._id, email))) {
          user.email = email;
          user.emailVerifiedAt = new Date();
        }

        logger.info('Linked existing user to Firebase UID (phone match)', {
          userId: user._id, uid,
        });
        return user;
      }
    }

    // 3. Try matching by email, only where that account proved the address
    //    too: one typed into a profile proves nothing
    if (email) {
      user = await User.findOne({ email, emailVerifiedAt: { $exists: true }, isActive: true });
      if (user) {
        user.firebaseUid = uid;
        if (phone && !user.phone) user.phone = phone;
        if (picture && !user.profilePhotoUrl) user.profilePhotoUrl = picture;
        await user.save();

        logger.info('Linked existing user to Firebase UID (email match)', {
          userId: user._id, uid,
        });
        return user;
      }
      // The owner of the address takes it from any account that only typed it in
      await takeVerifiedEmail(email);
    }

    // An unverified address someone already uses cannot be claimed or reused
    if (!email && claimed && (await User.exists({ email: claimed }))) {
      throw new AuthenticationError('Verify this email address before signing in: choose "Forgot password" to get a link by email.');
    }

    // 4. Brand-new user — create
    if (!phone && !email && !claimed) {
      throw new AuthenticationError(
        'Firebase token contains neither phone nor email. Cannot create user.',
      );
    }

    // A closed account that proved the same address keeps it
    const ownEmail = email && !(await User.exists({ email })) ? email : undefined;
    const newUser = await User.create({
      firebaseUid: uid,
      phone: phone || `firebase:${uid}`,       // phone is required field; placeholder for email-only accounts
      email: ownEmail,
      emailVerifiedAt: ownEmail ? new Date() : undefined,
      name: name || decoded.name || 'User',
      profilePhotoUrl: picture,
      capabilities: [UserCapability.RIDER],
    });

    EventBridge.publish('user-events', {
      eventType: 'user.registered',
      data: {
        userId: newUser._id,
        phone: newUser.phone,
        provider: 'firebase',
        firebaseUid: uid,
      },
    });

    logger.info('Created new user from Firebase auth', {
      userId: newUser._id, uid,
    });

    return newUser;
  }
}
