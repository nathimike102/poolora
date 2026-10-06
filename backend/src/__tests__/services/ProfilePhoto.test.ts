/**
 * Profile pictures: only real images are kept, a new one replaces the old
 * under a new link, and removing one clears it from the profile.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { User } from '../../models/User';
import { ProfilePhoto } from '../../models/ProfilePhoto';
import { ProfilePhotoService, MAX_PROFILE_PHOTO_BYTES } from '../../services/ProfilePhotoService';

jest.setTimeout(60_000);

let mongo: MongoMemoryServer;
const userId = new Types.ObjectId();
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]).toString('base64');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 2)]).toString('base64');

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await User.collection.insertOne({ _id: userId, name: 'Tendai', phone: '+263771234567', isActive: true });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe('ProfilePhotoService', () => {
  test('keeps a JPEG and points the profile at its link', async () => {
    const url = await ProfilePhotoService.set(userId.toString(), `data:image/jpeg;base64,${JPEG}`);
    expect(url).toMatch(/\/photos\/[a-f0-9]{32}$/);
    const user = await User.findById(userId).lean();
    expect(user?.profilePhotoUrl).toBe(url);
    const photo = await ProfilePhotoService.get(url.split('/').pop()!);
    expect(photo.contentType).toBe('image/jpeg');
  });

  test('a new picture replaces the old one under a new link', async () => {
    const first = await ProfilePhotoService.set(userId.toString(), JPEG);
    const second = await ProfilePhotoService.set(userId.toString(), PNG);
    expect(second).not.toBe(first);
    expect(await ProfilePhoto.countDocuments({ user: userId })).toBe(1);
    await expect(ProfilePhotoService.get(first.split('/').pop()!)).rejects.toThrow('not found');
    expect((await ProfilePhotoService.get(second.split('/').pop()!)).contentType).toBe('image/png');
  });

  test('refuses files that are not images, and oversized ones', async () => {
    await expect(ProfilePhotoService.set(userId.toString(), Buffer.from('<svg></svg>').toString('base64')))
      .rejects.toThrow('JPEG or PNG');
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(MAX_PROFILE_PHOTO_BYTES)]).toString('base64');
    await expect(ProfilePhotoService.set(userId.toString(), big)).rejects.toThrow('over 3 MB');
  });

  test('a link that is not a key is not looked up', async () => {
    await expect(ProfilePhotoService.get('../../etc')).rejects.toThrow('not found');
  });

  test('removing the picture clears it from the profile', async () => {
    await ProfilePhotoService.set(userId.toString(), JPEG);
    await ProfilePhotoService.remove(userId.toString());
    expect(await ProfilePhoto.countDocuments({ user: userId })).toBe(0);
    expect((await User.findById(userId).lean())?.profilePhotoUrl).toBeUndefined();
  });
});
