/**
 * Web admin rules against a real MongoDB: two-admin blocks, suspensions,
 * dispute decisions that really move money, settings that validate, apply
 * and revert, and reports and the dashboard built from real aggregations.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
jest.mock('../../services/MapsService', () => ({ getRoute: jest.fn() }));
jest.mock('../../services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    createNotification: jest.fn().mockResolvedValue(undefined),
    sendPushNotification: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { User } from '../../models/User';
import { Booking } from '../../models/Booking';
import { Wallet } from '../../models/Wallet';
import { WalletTransaction } from '../../models/WalletTransaction';
import { AdminAuditLog } from '../../models/AdminAuditLog';
import { AdminUserService } from '../../services/AdminUserService';
import { DisputeService } from '../../services/DisputeService';
import { SettingsService } from '../../services/SettingsService';
import { ReportService, REPORT_TYPES, parseReportParams } from '../../services/ReportService';
import { AdminOverviewService } from '../../services/AdminOverviewService';
import { WalletService } from '../../services/WalletService';
import { config } from '../../config';
import { BookingStatus } from '../../types';

jest.setTimeout(60_000);

let mongo: MongoMemoryServer;
const users = new AdminUserService();
const disputes = new DisputeService();
const adminA = new Types.ObjectId().toString();
const adminB = new Types.ObjectId().toString();
const riderId = new Types.ObjectId();
const driverId = new Types.ObjectId();

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
    { _id: riderId, name: 'Asha Rider', phone: '+919000000001', capabilities: ['rider'], kyc: { status: 'none' }, stats: {}, warnings: 0, createdAt: new Date() },
    { _id: driverId, name: 'Ravi Driver', phone: '+919000000002', capabilities: ['rider', 'driver'], kyc: { status: 'approved' }, stats: {}, warnings: 0, createdAt: new Date() },
  ]);
});

describe('account moderation', () => {
  it('needs a second admin to block an account', async () => {
    await users.requestBlock(riderId.toString(), adminA, 'Repeated fake bookings');
    await expect(users.approveBlock(riderId.toString(), adminA)).rejects.toMatchObject({ errorId: 'SECOND_ADMIN_REQUIRED' });

    await users.approveBlock(riderId.toString(), adminB);
    const rider = await User.findById(riderId).lean();
    expect(rider).toMatchObject({ isBlocked: true, blockReason: 'Repeated fake bookings' });
    expect(rider?.pendingBlock?.requestedAt).toBeUndefined();
    expect(await AdminAuditLog.countDocuments({ targetId: riderId.toString() })).toBe(2);
  });

  it('suspends for a fixed length, with a reason, and reinstates', async () => {
    await expect(users.suspend(riderId.toString(), adminA, 10, 'Late cancellations')).rejects.toThrow('7, 15 or 30');
    await expect(users.suspend(riderId.toString(), adminA, 7, '')).rejects.toThrow('reason');

    await users.suspend(riderId.toString(), adminA, 7, 'Late cancellations');
    const suspended = await User.findById(riderId).lean();
    expect(suspended?.isSuspended).toBe(true);
    expect(suspended!.suspendedUntil!.getTime()).toBeGreaterThan(Date.now() + 6.9 * 86_400_000);

    await users.reinstate(riderId.toString(), adminA, 'Appeal accepted');
    expect((await User.findById(riderId).lean())?.isSuspended).toBe(false);
  });

  it('finds users by name or phone', async () => {
    expect((await users.search({ q: 'asha', page: 1, limit: 10 })).total).toBe(1);
    expect((await users.search({ q: '9000000002', page: 1, limit: 10 })).users[0].name).toBe('Ravi Driver');
  });
});

describe('dispute decisions', () => {
  async function cancelledWalletBooking() {
    // The rider paid ₹400 from the wallet and got ₹200 back on a late cancellation
    const booking = await Booking.create({
      ride: new Types.ObjectId(), rider: riderId, driver: driverId, status: BookingStatus.CANCELLED,
      seatsBooked: 1, estimatedFare: 400, refundAmount: 200, cancelledAt: new Date(),
      pickup: { location: { type: 'Point', coordinates: [77.6, 12.9] }, address: 'A' },
      dropoff: { location: { type: 'Point', coordinates: [77.7, 12.95] }, address: 'B' },
    });
    await new WalletService().refundToWallet(riderId.toString(), booking._id.toString(), 200, 'Late cancellation');
    return booking;
  }

  it('refunds the rest to the rider even after a cancellation refund, and warns the driver', async () => {
    const booking = await cancelledWalletBooking();
    const dispute = await disputes.create(riderId.toString(), {
      bookingId: booking._id.toString(), category: 'cancellation', description: 'The driver told me to cancel, then left without me.',
    });

    const detail = await disputes.detail(dispute._id.toString());
    expect(detail.refundable).toBe(200);
    await expect(disputes.resolve(dispute._id.toString(), adminA, {
      outcome: 'rider', refundAmount: 250, justification: 'Chat shows the driver asked the rider to cancel.',
    })).rejects.toThrow('between ₹0 and ₹200');

    const resolved = await disputes.resolve(dispute._id.toString(), adminA, {
      outcome: 'rider', refundAmount: 200, warn: ['driver'], justification: 'Chat shows the driver asked the rider to cancel.',
    });

    expect(resolved.decision).toMatchObject({ outcome: 'rider', refundAmount: 200, refundStatus: 'wallet' });
    expect((await Wallet.findOne({ userId: riderId }).lean())?.balance).toBe(400);
    expect(await WalletTransaction.countDocuments({ userId: riderId })).toBe(2);
    expect((await User.findById(driverId).lean())?.warnings).toBe(1);
    expect((await Booking.findById(booking._id).lean())?.refundAmount).toBe(400);
    await expect(disputes.resolve(dispute._id.toString(), adminB, {
      outcome: 'rider', justification: 'Second attempt at the same decision.',
    })).rejects.toThrow('already resolved');
  });

  it('only lets people on the booking raise a dispute, once at a time', async () => {
    const booking = await cancelledWalletBooking();
    const input = { bookingId: booking._id.toString(), category: 'behavior', description: 'Rude on the phone about the pickup.' };
    await expect(disputes.create(new Types.ObjectId().toString(), input)).rejects.toThrow('not part of this booking');
    await disputes.create(driverId.toString(), input);
    await expect(disputes.create(driverId.toString(), input)).rejects.toThrow('already have an open dispute');
  });
});

describe('platform settings', () => {
  const original = config.ride.platformFeeRate;
  afterEach(async () => {
    await SettingsService.load(); // back to defaults: the database was dropped
  });

  it('applies a valid change at once and reverts it', async () => {
    await SettingsService.update({ platformFeeRate: 0.18 }, adminA, 'Pilot a higher commission');
    expect(config.ride.platformFeeRate).toBe(0.18);

    const [change] = await SettingsService.history();
    await SettingsService.revert(change._id.toString(), adminB, 'Pilot ended');
    expect(config.ride.platformFeeRate).toBe(original);
  });

  it('rejects the whole change when one value is invalid', async () => {
    await expect(
      SettingsService.update({ platformFeeRate: 0.2, matchingWeights: { proximity: 0.5, time: 0.5, rating: 0.5, acceptance: 0, safety: 0 } }, adminA, 'Tune matching'),
    ).rejects.toThrow('add up to 150%');
    expect(config.ride.platformFeeRate).toBe(original);
  });

  it('refuses refund tiers that pay more for cancelling later', async () => {
    await expect(
      SettingsService.update({ riderCancellationRefunds: [{ minHours: 24, refundRate: 0.5 }, { minHours: 0, refundRate: 1 }] }, adminA, 'New policy'),
    ).rejects.toThrow('cannot refund more');
  });

  it('is picked up from the database by other instances', async () => {
    await SettingsService.update({ maxActivePerDriver: 7 }, adminA, 'Allow more rides');
    (config.ride as unknown as Record<string, unknown>).maxActivePerDriver = 5; // as another instance sees it
    await SettingsService.load();
    expect(config.ride.maxActivePerDriver).toBe(7);
  });
});

describe('reports and dashboard', () => {
  it.each(REPORT_TYPES)('builds the %s report and its CSV', async (type) => {
    const service = new ReportService();
    const report = await service.build(type, parseReportParams({ groupBy: 'week' }));
    expect(report.summary.length).toBeGreaterThan(0);
    expect(report.series.length).toBeGreaterThanOrEqual(4);
    expect(service.toCsv(report)).toContain(`Poolora ${type} report`);
  });

  it('refuses a range longer than two years', () => {
    expect(() => parseReportParams({ from: '2020-01-01', to: '2026-01-01' })).toThrow('two years');
  });

  it('builds the dashboard overview', async () => {
    const data = await new AdminOverviewService().overview();
    expect(data.users.total).toBe(2);
    expect(data.users.drivers).toBe(1);
    expect(data.system.databaseMs).not.toBeNull();
    expect(Array.isArray(data.anomalies)).toBe(true);
  });
});
