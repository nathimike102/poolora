/**
 * Money on a parcel: paid from the wallet or by card (recorded by the
 * webhook), accepted only once paid, refunded when cancelled or declined
 * before pickup, and the driver's share counted on delivery.
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

import { User } from '../../models/User';
import { Ride } from '../../models/Ride';
import { Wallet } from '../../models/Wallet';
import { ParcelPooling } from '../../models/ParcelPooling';
import { ParcelPoolingService } from '../../services/ParcelPoolingService';
import { ParcelEvidenceService } from '../../services/ParcelEvidenceService';
import { config } from '../../config';

jest.setTimeout(60_000);

const evidence = new ParcelEvidenceService();
// Photos go to the database here, never to S3
(config.aws as { accessKeyId: string }).accessKeyId = '';
/** The smallest JPEG header the photo check accepts */
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]).toString('base64');
let mongo: MongoMemoryServer;
const service = new ParcelPoolingService();
const senderId = new Types.ObjectId();
const driverId = new Types.ObjectId();
const rideId = new Types.ObjectId();
const HOUR = 3_600_000;

const place = (address: string, lng: number) => ({ lng, lat: 12.97, address, contactPerson: 'Asha Rao', contactPhone: '+919000000001' });
const request = (overrides: Record<string, unknown> = {}) => ({
  rideId: rideId.toString(),
  parcelWeight: 2,
  parcelType: 'document' as const,
  pickupLocation: place('Indiranagar, Bengaluru', 77.64),
  deliveryLocation: place('Marathahalli, Bengaluru', 77.7),
  estimatedDeliveryTime: new Date(Date.now() + 6 * HOUR),
  useWallet: true,
  ...overrides,
});

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
  await User.collection.insertMany([
    { _id: senderId, name: 'Asha Rao', phone: '+919000000001', capabilities: ['rider'], kyc: { status: 'none' }, stats: {} },
    { _id: driverId, name: 'Ravi Kumar', phone: '+919000000002', capabilities: ['rider', 'driver'], kyc: { status: 'approved' }, stats: { totalEarnings: 0 } },
  ]);
  await Ride.collection.insertOne({
    _id: rideId, driver: driverId, status: 'scheduled', departureTime: new Date(Date.now() + 3 * HOUR),
    pickup: { location: { type: 'Point', coordinates: [77.64, 12.97] }, address: 'Indiranagar' },
    dropoff: { location: { type: 'Point', coordinates: [77.7, 12.96] }, address: 'Marathahalli' },
  });
  await Wallet.create({ userId: senderId, balance: 500 });
});

const balance = async () => (await Wallet.findOne({ userId: senderId }).lean())!.balance;

it('pays from the wallet, and refunds it when the sender cancels before pickup', async () => {
  const { parcel, razorpayOrder } = await service.createParcelRequest(senderId.toString(), request());
  expect(razorpayOrder).toBeNull();
  expect(parcel).toMatchObject({ paymentMethod: 'wallet', paymentStatus: 'paid' });
  expect(await balance()).toBe(500 - parcel.estimatedCost);

  const cancelled = await service.cancelParcel(parcel._id.toString(), senderId.toString(), 'Plans changed');
  expect(cancelled).toMatchObject({ status: 'cancelled', paymentStatus: 'refunded', refundAmount: parcel.estimatedCost });
  expect(await balance()).toBe(500);
});

it('refunds the sender when the driver declines', async () => {
  const { parcel } = await service.createParcelRequest(senderId.toString(), request());
  await service.rejectParcelRequest(parcel._id.toString(), driverId.toString());
  expect(await balance()).toBe(500);
});

it('leaves nothing behind when the wallet is short', async () => {
  await Wallet.updateOne({ userId: senderId }, { $set: { balance: 1 } });
  await expect(service.createParcelRequest(senderId.toString(), request())).rejects.toMatchObject({ errorId: 'INSUFFICIENT_BALANCE' });
  expect(await ParcelPooling.countDocuments()).toBe(0);
});

it('lets the driver accept only a paid parcel, recorded by the card webhook', async () => {
  const unpaid = await ParcelPooling.create({
    ride: rideId, sender: senderId, driver: driverId, status: 'pending', parcelWeight: 1, parcelType: 'general',
    pickupLocation: { location: { type: 'Point', coordinates: [77.64, 12.97] }, address: 'Indiranagar', contactPerson: 'A', contactPhone: '+919000000001' },
    deliveryLocation: { location: { type: 'Point', coordinates: [77.7, 12.96] }, address: 'Marathahalli', contactPerson: 'B', contactPhone: '+919000000003' },
    estimatedDeliveryTime: new Date(Date.now() + 6 * HOUR), estimatedCost: 80, trackingNumber: 'TRK-ABC-0123ABCD',
    razorpayOrderId: 'order_parcel_1', paymentMethod: 'razorpay',
  });
  await expect(service.acceptParcelRequest(unpaid._id.toString(), driverId.toString())).rejects.toMatchObject({ errorId: 'PARCEL_NOT_PAID' });

  expect(await service.recordRazorpayPayment('order_parcel_1', 'pay_1', true)).toBe(true);
  expect(await service.recordRazorpayPayment('order_booking_x', 'pay_2', true)).toBe(false);
  const accepted = await service.acceptParcelRequest(unpaid._id.toString(), driverId.toString());
  expect(accepted).toMatchObject({ status: 'confirmed', paymentStatus: 'paid', razorpayPaymentId: 'pay_1' });
});

it('counts the driver share on delivery and refuses cancelling once picked up', async () => {
  const { parcel, deliveryOtp } = await service.createParcelRequest(senderId.toString(), request());
  const id = parcel._id.toString();
  await service.acceptParcelRequest(id, driverId.toString());
  await expect(service.pickupParcel(id, driverId.toString())).rejects.toMatchObject({ errorId: 'PHOTO_REQUIRED' });
  await evidence.addPhoto(id, driverId.toString(), { stage: 'pickup', data: JPEG });
  await service.pickupParcel(id, driverId.toString());
  await expect(service.cancelParcel(id, senderId.toString(), 'Too late')).rejects.toMatchObject({ errorId: 'PARCEL_PICKED_UP' });
  await evidence.addPhoto(id, driverId.toString(), { stage: 'delivery', data: JPEG });

  const done = await service.completeDelivery(id, driverId.toString(), { signature: 'signed', otp: deliveryOtp });
  expect(done.driverEarnings! + done.platformFee!).toBeCloseTo(parcel.estimatedCost, 2);
  expect((await User.findById(driverId).lean())?.stats.totalEarnings).toBe(done.driverEarnings);
});

it('refuses parcels on your own ride or on a ride that has left', async () => {
  await expect(service.createParcelRequest(driverId.toString(), request())).rejects.toMatchObject({ errorId: 'SELF_PARCEL' });
  await Ride.updateOne({ _id: rideId }, { $set: { departureTime: new Date(Date.now() - HOUR) } });
  await expect(service.createParcelRequest(senderId.toString(), request())).rejects.toMatchObject({ errorId: 'RIDE_NOT_AVAILABLE' });
});
