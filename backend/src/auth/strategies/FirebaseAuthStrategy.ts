import admin from 'firebase-admin';
import { AuthStrategy, AuthResult, AuthProvider } from '../AuthStrategy';
import { getFirebaseAuth } from '../../config/firebase';
import { User, IUser } from '../../models/User';
import { UserCapability } from '../../types';
import { AuthenticationError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { EventBridge } from '../../events';

/**
 * Verifies Firebase ID tokens and synchronizes the user into the local database.
 *
 * Flow:
 *   1. admin.auth().verifyIdToken(token)
 *   2. Look up the user by firebaseUid  (fast path)
 *   3. Fall back to look-up by phone / email (linking path)
 *   4. Create a brand-new user if neither matches (registration path)
 */
export class FirebaseAuthStrategy implements AuthStrategy {
  async authenticate(token: string): Promise<AuthResult> {
    let decoded: admin.auth.DecodedIdToken;

    try {
      decoded = await getFirebaseAuth().verifyIdToken(token, true /* checkRevoked */);
    } catch (err: any) {
      const code = err.code ?? '';
      if (code === 'auth/id-token-expired') {
        throw new AuthenticationError('Firebase token has expired');
      }
      if (code === 'auth/id-token-revoked') {
        throw new AuthenticationError('Firebase token has been revoked');
      }
      if (code === 'auth/argument-error') {
        throw new AuthenticationError('Malformed Firebase token');
      }
      // Any other Firebase error — let the caller try fallback
      throw new AuthenticationError('Firebase token verification failed');
    }

    const user = await this.syncUser(decoded);
    return { user, provider: AuthProvider.FIREBASE };
  }

  // ─── User Synchronization ───────────────────────────────────────────────

  private async syncUser(decoded: admin.auth.DecodedIdToken): Promise<IUser> {
    const { uid, phone_number: phone, email, name, picture } = decoded;

    // 1. Fast path — user already linked
    let user = await User.findOne({ firebaseUid: uid, isActive: true });
    if (user) return user;

    // 2. Try matching by phone (most common for Indian ride-hailing)
    if (phone) {
      user = await User.findOne({ phone, isActive: true });
      if (user) {
        user.firebaseUid = uid;
        if (email && !user.email) user.email = email;
        if (picture && !user.profilePhotoUrl) user.profilePhotoUrl = picture;
        await user.save();

        logger.info('Linked existing user to Firebase UID (phone match)', {
          userId: user._id, uid,
        });
        return user;
      }
    }

    // 3. Try matching by email
    if (email) {
      user = await User.findOne({ email, isActive: true });
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
    }

    // 4. Brand-new user — create
    if (!phone && !email) {
      throw new AuthenticationError(
        'Firebase token contains neither phone nor email. Cannot create user.',
      );
    }

    const newUser = await User.create({
      firebaseUid: uid,
      phone: phone || `firebase:${uid}`,       // phone is required field; placeholder for email-only accounts
      email,
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
