/**
 * Parcel photo proof (UC-P03) and claims (UC-P05) against a real MongoDB:
 * who may add photos and when, real image checks, who may see them, the
 * claim windows and cover limits, and payouts into the wallet once.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
jest.mock('../../services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    createNotification: jest.fn().mockResolvedValue(undefined),
    sendPushNotification: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { ParcelPooling } from '../../models/ParcelPooling';
import { Wallet } from '../../models/Wallet';
import { ParcelEvidenceService } from '../../services/ParcelEvidenceService';
import { config } from '../../config';

jest.setTimeout(60_000);
(config.aws as { accessKeyId: string }).accessKeyId = ''; // photos go to the database here

let mongo: MongoMemoryServer;
const evidence = new ParcelEvidenceService();
const [sender, driver, stranger, admin] = [0, 1, 2, 3].map(() => new Types.ObjectId().toString());
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 1, 2, 3]);
const HOUR = 3_600_000;

async function parcel(fields: Record<string, unknown> = {}) {
  const _id = new Types.ObjectId();
  const place = { location: { type: 'Point', coordinates: [77.6, 12.9] }, address: 'Somewhere', contactPerson: 'Asha', contactPhone: '+919000000001' };
  await ParcelPooling.collection.insertOne({
    _id, ride: new Types.ObjectId(), sender: new Types.ObjectId(sender), driver: new Types.ObjectId(driver), status: 'confirmed',
    parcelWeight: 1, parcelType: 'general', pickupLocation: place, deliveryLocation: place,
    estimatedDeliveryTime: new Date(Date.now() + 3 * HOUR), estimatedCost: 120, trackingNumber: `T${_id}`, deliveryOtpAttempts: 0,
    ...fields,
  });
  return _id.toString();
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  await mongoose.connection.db!.dropDatabase();
});

describe('photo proof', () => {
  it('takes real images from the driver at the right stage, and shows them only to the people involved', async () => {
    const id = await parcel();
    await expect(evidence.addPhoto(id, stranger, { stage: 'pickup', data: JPEG.toString('base64') })).rejects.toThrow('Only the driver');
    await expect(evidence.addPhoto(id, driver, { stage: 'delivery', data: JPEG.toString('base64') })).rejects.toThrow('Pick the parcel up first');
    await expect(evidence.addPhoto(id, driver, { stage: 'pickup', data: Buffer.from('<svg/>').toString('base64') })).rejects.toMatchObject({ errorId: 'UNSUPPORTED_FILE_TYPE' });

    const { photo } = await evidence.addPhoto(id, driver, { stage: 'pickup', data: `data:image/jpeg;base64,${JPEG.toString('base64')}`, lat: 12.9, lng: 77.6 });
    expect(photo).toMatchObject({ stage: 'pickup', location: { lat: 12.9, lng: 77.6 } });

    const file = await evidence.photoFile(id, photo.id, { userId: sender });
    expect(file).toEqual({ contentType: 'image/jpeg', body: JPEG });
    await expect(evidence.photoFile(id, photo.id, { userId: stranger })).rejects.toThrow('not found');
    expect((await evidence.photoFile(id, photo.id, { userId: admin, capabilities: ['admin'] })).body.length).toBe(JPEG.length);
  });
});

describe('claims', () => {
  it('pays an approved damage claim into the wallet once, up to the declared value', async () => {
    const id = await parcel({ status: 'completed', actualPickupTime: new Date(Date.now() - 5 * HOUR), actualDeliveryTime: new Date(Date.now() - HOUR), insuranceValue: 2000, insuranceCost: 40 });
    await expect(evidence.fileClaim(id, sender, { kind: 'damaged', description: 'The screen arrived cracked', amount: 1500 })).rejects.toThrow('photo of the damage');
    const { photo } = await evidence.addPhoto(id, sender, { stage: 'claim', data: JPEG.toString('base64') });
    await expect(evidence.fileClaim(id, sender, { kind: 'damaged', description: 'The screen arrived cracked', amount: 2500, photoIds: [photo.id] })).rejects.toMatchObject({ errorId: 'OVER_COVER' });

    const { claim } = await evidence.fileClaim(id, sender, { kind: 'damaged', description: 'The screen arrived cracked', amount: 1500, photoIds: [photo.id] });
    expect(claim).toMatchObject({ insured: true, coverLimit: 2000, status: 'submitted' });
    await expect(evidence.fileClaim(id, sender, { kind: 'damaged', description: 'Again', amount: 10, photoIds: [photo.id] })).rejects.toThrow('already open');

    const { claims } = await evidence.adminList();
    expect(claims[0].evidence).toHaveLength(1);
    await evidence.decide(claim._id.toString(), admin, { decision: 'approve', payout: 1200, note: 'Photos show impact damage' });
    expect((await Wallet.findOne({ userId: sender }).lean())?.balance).toBe(1200);
    await expect(evidence.decide(claim._id.toString(), admin, { decision: 'approve', note: 'Twice?' })).rejects.toThrow('already been decided');
  });

  it('covers an uninsured parcel up to the delivery charge, and a lost one only once it is overdue', async () => {
    const id = await parcel({ actualPickupTime: new Date(Date.now() - 2 * HOUR) });
    await expect(evidence.fileClaim(id, sender, { kind: 'lost', description: 'Never arrived at the office', amount: 100 })).rejects.toThrow('hours after it was due');
    await ParcelPooling.updateOne({ _id: id }, { estimatedDeliveryTime: new Date(Date.now() - 30 * HOUR) });
    await expect(evidence.fileClaim(id, sender, { kind: 'lost', description: 'Never arrived at the office', amount: 500 })).rejects.toThrow('delivery charge');
    const { claim } = await evidence.fileClaim(id, sender, { kind: 'lost', description: 'Never arrived at the office', amount: 120 });
    await evidence.decide(claim._id.toString(), admin, { decision: 'reject', note: 'Found and delivered the next morning' });
    expect(await Wallet.countDocuments({ userId: sender })).toBe(0);
  });

  it('closes damage claims 7 days after delivery', async () => {
    const id = await parcel({ status: 'completed', actualDeliveryTime: new Date(Date.now() - 8 * 24 * HOUR) });
    await expect(evidence.fileClaim(id, sender, { kind: 'damaged', description: 'Found a dent later', amount: 50 })).rejects.toThrow('within 7 days');
  });
});
