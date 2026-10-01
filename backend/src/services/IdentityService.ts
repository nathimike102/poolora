/**
 * IdentityService.ts
 *
 * Identity checks for women-only rides (PRD "Safe for her": women-only rides
 * with verification). A user sends a photo of an ID document (national ID,
 * passport or driving licence) and a selfie taken in the app, and says their
 * gender. An admin checks that the selfie is the person on the document,
 * then confirms the gender the person lives as, from their declaration and
 * the selfie: the document proves who they are, not their gender, so a trans
 * woman is a woman here. Only then can a woman post or book women-only rides.
 *
 * A declared gender alone is not enough: the threat women-only rides guard
 * against is a man claiming to be a woman to get into one. Once verified,
 * the gender cannot be changed from the app; it goes through support.
 *
 * The two photos are deleted as soon as an admin has decided; only the
 * decision (who, when, the gender confirmed) is kept.
 */

import { Types } from 'mongoose';
import { IUser, User } from '../models/User';
import { AppError, NotFoundError } from '../utils/AppError';
import { audit } from './AuditService';
import { NotificationService } from './NotificationService';
import { kycPrefix } from './UploadService';
import { logger } from '../utils/logger';

export type Gender = 'male' | 'female' | 'other';
const GENDERS: Gender[] = ['male', 'female', 'other'];

/** The one rule for women-only rides: a woman whose identity check passed. */
export function isVerifiedWoman(user: Pick<IUser, 'gender' | 'identity'> | null | undefined): boolean {
  return Boolean(user && user.gender === 'female' && user.identity?.status === 'verified');
}

/** The error a user sees when a women-only ride is closed to them. */
export function womenOnlyRefusal(user: Pick<IUser, 'gender' | 'identity'> | null | undefined): AppError {
  if (user?.gender === 'female' && user.identity?.status === 'pending') {
    return new AppError('Women-only rides open to you once your identity check is approved. We usually review it within a day.', 403, 'IDENTITY_PENDING');
  }
  if (user?.gender === 'female' || user?.identity?.declaredGender === 'female') {
    return new AppError('Women-only rides are for women who have verified their identity. Verify it in Profile > Identity check.', 403, 'IDENTITY_NOT_VERIFIED');
  }
  return new AppError('This ride is for women only.', 403, 'WOMEN_ONLY');
}

function publicView(user: Pick<IUser, 'gender' | 'identity'>) {
  const check = user.identity;
  return {
    status: check?.status ?? 'none',
    gender: user.gender ?? null,
    declaredGender: check?.declaredGender ?? null,
    submittedAt: check?.submittedAt ?? null,
    reviewedAt: check?.reviewedAt ?? null,
    rejectionReason: check?.status === 'rejected' ? check.rejectionReason ?? null : null,
  };
}

export class IdentityService {
  private notifications = new NotificationService();

  async status(userId: string) {
    const user = await User.findById(userId).select('gender identity').lean();
    if (!user) throw new NotFoundError('User');
    return publicView(user);
  }

  /** The user sends their document and selfie (uploaded first through /uploads/kyc). */
  async submit(userId: string, input: { documentUrl: unknown; selfieUrl: unknown; gender: unknown }) {
    const user = await User.findById(userId).select('gender identity');
    if (!user) throw new NotFoundError('User');
    if (user.identity?.status === 'verified') {
      throw new AppError('Your identity is already verified. To change it, contact support.', 409, 'IDENTITY_VERIFIED');
    }
    const gender = String(input.gender) as Gender;
    if (!GENDERS.includes(gender)) throw new AppError('Choose your gender', 422, 'VALIDATION_ERROR');
    const prefix = kycPrefix(userId);
    for (const [name, url] of [['document', input.documentUrl], ['selfie', input.selfieUrl]] as const) {
      if (typeof url !== 'string' || !url.startsWith(prefix)) {
        throw new AppError(`Upload the ${name} again`, 422, 'INVALID_DOCUMENT');
      }
    }

    user.identity = {
      status: 'pending',
      declaredGender: gender,
      documentUrl: input.documentUrl as string,
      selfieUrl: input.selfieUrl as string,
      submittedAt: new Date(),
    };
    // What the user says until an admin confirms it; only a verified woman gets women-only rides
    user.gender = gender;
    await user.save();
    return publicView(user);
  }

  /** The user's own gender on their profile. Locked once an admin has confirmed it. */
  async setDeclaredGender(userId: string, gender: unknown): Promise<void> {
    if (gender === undefined) return;
    const user = await User.findById(userId).select('gender identity');
    if (!user) throw new NotFoundError('User');
    if (user.identity?.status === 'verified' && user.gender !== gender) {
      throw new AppError('Your gender was confirmed with your ID. To change it, contact support.', 409, 'IDENTITY_VERIFIED');
    }
    if (!GENDERS.includes(gender as Gender)) throw new AppError('Choose your gender', 422, 'VALIDATION_ERROR');
    user.gender = gender as Gender;
    await user.save();
  }

  // ─── Admins ────────────────────────────────────────────────────────────────

  async queue(status: string = 'pending') {
    const users = await User.find({ 'identity.status': status })
      .select('name phone gender identity.status identity.declaredGender identity.submittedAt identity.reviewedAt identity.rejectionReason')
      .sort({ 'identity.submittedAt': 1 })
      .limit(200)
      .lean();
    return users.map((u) => ({
      _id: u._id,
      name: u.name,
      phone: u.phone,
      ...publicView(u as Pick<IUser, 'gender' | 'identity'>),
    }));
  }

  /** One check, with short-lived links to the two photos. */
  async detail(userId: string) {
    const user = await User.findById(userId).select('name phone gender identity profilePhotoUrl createdAt').lean();
    if (!user?.identity) throw new NotFoundError('Identity check');
    const { presignKycDownload } = await import('./UploadService');
    const sign = (url?: string) => (!url ? Promise.resolve(null) : presignKycDownload(url).catch((error: Error) => {
      logger.warn('Could not sign an identity document', { userId, error: error.message });
      return null;
    }));
    const [document, selfie] = await Promise.all([sign(user.identity.documentUrl), sign(user.identity.selfieUrl)]);
    return {
      _id: user._id,
      name: user.name,
      phone: user.phone,
      profilePhotoUrl: user.profilePhotoUrl ?? null,
      memberSince: user.createdAt,
      ...publicView(user as Pick<IUser, 'gender' | 'identity'>),
      links: { document, selfie },
      photosDeleted: Boolean(user.identity.photosDeletedAt),
    };
  }

  /** The selfie matches the document; `gender` is the one the admin confirmed. */
  async approve(userId: string, adminId: string, gender: unknown) {
    if (!GENDERS.includes(gender as Gender)) throw new AppError('Confirm the gender', 422, 'VALIDATION_ERROR');
    const user = await User.findOneAndUpdate(
      { _id: userId, 'identity.status': 'pending' },
      {
        $set: {
          gender,
          'identity.status': 'verified',
          'identity.reviewedAt': new Date(),
          'identity.reviewedBy': new Types.ObjectId(adminId),
        },
        $unset: { 'identity.rejectionReason': 1 },
      },
      { new: true },
    );
    if (!user) throw new AppError('This check is not waiting for review', 409, 'CONFLICT');
    await audit(adminId, 'identity.approve', 'user', userId, `Gender confirmed: ${gender}`);
    // In the background: the admin does not wait on the file store
    void this.deletePhotos(userId, user.identity);
    const womenOnly = gender === 'female' ? ' You can now post and book women-only rides.' : '';
    await this.tell(userId, 'Identity verified', `Your identity check is approved.${womenOnly}`);
    return publicView(user);
  }

  async reject(userId: string, adminId: string, reason: unknown) {
    const why = typeof reason === 'string' ? reason.trim() : '';
    if (why.length < 5) throw new AppError('Say what the user should fix', 422, 'VALIDATION_ERROR');
    const user = await User.findOneAndUpdate(
      { _id: userId, 'identity.status': 'pending' },
      {
        $set: {
          'identity.status': 'rejected',
          'identity.reviewedAt': new Date(),
          'identity.reviewedBy': new Types.ObjectId(adminId),
          'identity.rejectionReason': why.slice(0, 500),
        },
      },
      { new: true },
    );
    if (!user) throw new AppError('This check is not waiting for review', 409, 'CONFLICT');
    await audit(adminId, 'identity.reject', 'user', userId, why);
    void this.deletePhotos(userId, user.identity);
    await this.tell(userId, 'Identity check not approved', `${why} You can send it again from Profile > Identity check.`);
    return publicView(user);
  }

  /**
   * Deletes the ID photo and selfie once decided. Only these exact files, and
   * the references are cleared only if still the same, so a resubmission in
   * the meantime is never touched. If the store refuses, the references stay
   * so the account closing removes them.
   */
  async deletePhotos(userId: string, files?: { documentUrl?: string; selfieUrl?: string }): Promise<void> {
    const check = files ?? (await User.findById(userId).select('identity.documentUrl identity.selfieUrl').lean())?.identity;
    const urls = [check?.documentUrl, check?.selfieUrl].filter((u): u is string => Boolean(u));
    if (!urls.length) return;
    try {
      const { deleteKycFiles } = await import('./UploadService');
      await deleteKycFiles(urls);
      await User.updateOne(
        { _id: userId, 'identity.documentUrl': check?.documentUrl, 'identity.selfieUrl': check?.selfieUrl },
        { $unset: { 'identity.documentUrl': 1, 'identity.selfieUrl': 1 }, $set: { 'identity.photosDeletedAt': new Date() } },
      );
    } catch (error) {
      logger.error('Could not delete identity photos after review', { userId, error: (error as Error).message });
    }
  }

  private async tell(userId: string, title: string, body: string): Promise<void> {
    await Promise.all([
      this.notifications.createNotification(userId, title, body, 'system'),
      this.notifications.sendPushNotification(userId, title, body, { type: 'identity' }),
    ]).catch(() => undefined);
  }

  /** How many are waiting, for the admin sidebar. */
  static waiting(): Promise<number> {
    return User.countDocuments({ 'identity.status': 'pending' });
  }
}
