import { randomBytes } from 'crypto';
import { config } from '../config';
import { ProfilePhoto } from '../models/ProfilePhoto';
import { User } from '../models/User';
import { AppError, NotFoundError } from '../utils/AppError';

/** The app crops to a square and compresses; this only stops abuse */
export const MAX_PROFILE_PHOTO_BYTES = 3 * 1024 * 1024;

/** What the bytes start with, so a mislabelled or non-image file is refused */
function sniff(buf: Buffer): 'image/jpeg' | 'image/png' | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  return null;
}

export function profilePhotoUrl(key: string): string {
  return `${config.app.baseUrl.replace(/\/$/, '')}/photos/${key}`;
}

export const ProfilePhotoService = {
  /** Replaces the person's picture and points their profile at it. */
  async set(userId: string, base64: string): Promise<string> {
    const buf = Buffer.from(String(base64 ?? '').replace(/^data:image\/\w+;base64,/, ''), 'base64');
    if (!buf.length) throw new AppError('Choose a photo', 400, 'PHOTO_REQUIRED');
    if (buf.length > MAX_PROFILE_PHOTO_BYTES) throw new AppError('The photo is over 3 MB; choose a smaller one', 413, 'PHOTO_TOO_LARGE');
    const contentType = sniff(buf);
    if (!contentType) throw new AppError('Use a JPEG or PNG photo', 400, 'UNSUPPORTED_FILE_TYPE');

    // A new key each time, so a phone that cached the old picture fetches the new one
    const key = randomBytes(16).toString('hex');
    await ProfilePhoto.findOneAndUpdate(
      { user: userId },
      { key, contentType, bytes: buf.length, data: buf },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const url = profilePhotoUrl(key);
    await User.updateOne({ _id: userId }, { $set: { profilePhotoUrl: url } });
    return url;
  },

  /** Removes the picture; the profile falls back to the person's initial. */
  async remove(userId: string): Promise<void> {
    await ProfilePhoto.deleteOne({ user: userId });
    await User.updateOne({ _id: userId }, { $unset: { profilePhotoUrl: 1 } });
  },

  async get(key: string): Promise<{ contentType: string; data: Buffer }> {
    if (!/^[a-f0-9]{32}$/.test(key)) throw new NotFoundError('Photo');
    const photo = await ProfilePhoto.findOne({ key }).select('+data contentType');
    if (!photo) throw new NotFoundError('Photo');
    return { contentType: photo.contentType, data: photo.data };
  },
};
