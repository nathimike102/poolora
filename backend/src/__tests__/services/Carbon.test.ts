/**
 * CO₂ saved by shared seats (UC-R11): the formula, the rider's leg along the
 * route, and, against a real MongoDB, what completing a booking records, the
 * user's impact, the platform total and the backfill of older bookings.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
jest.mock('../../services/MapsService', () => ({ getRoute: jest.fn() }));
jest.mock('../../services/ReceiptService', () => ({
  ReceiptService: jest.fn().mockImplementation(() => ({ emailOnCompletion: jest.fn().mockResolvedValue(undefined) })),
}));
jest.mock('../../services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendPushNotification: jest.fn().mockResolvedValue(undefined),
    createNotification: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { config } from '../../config';
import { Booking } from '../../models/Booking';
import { Ride } from '../../models/Ride';
import { User } from '../../models/User';
import { BookingService } from '../../services/BookingService';
import { CarbonService, co2SavedKg, legDistanceKm } from '../../services/CarbonService';
import { encodePolyline } from '../../utils/routeGeometry';
import { BookingStatus, RideStatus } from '../../types';

jest.setTimeout(60_000);

const point = (lat: number, lng: number) => ({ location: { type: 'Point' as const, coordinates: [lng, lat] as [number, number] }, address: 'x' });

describe('the saving for one booking', () => {
  it('is going alone in an average car, less the rider\'s share of the shared car', () => {
    // 10 km in a sedan with the driver and one rider: 1.7 kg alone, 0.85 kg as half the car
    expect(co2SavedKg({ legKm: 10, vehicleType: 'sedan', seats: 1, onBoard: 2 })).toBe(0.85);
    // A fuller car saves more per seat
    expect(co2SavedKg({ legKm: 10, vehicleType: 'sedan', seats: 1, onBoard: 4 })).toBeCloseTo(1.28, 2);
  });

  it('counts one car for a booking, however many seats it holds', () => {
    // Two seats: still 1.7 kg alone, but two of three people in the car
    expect(co2SavedKg({ legKm: 10, vehicleType: 'sedan', seats: 2, onBoard: 3 })).toBeCloseTo(0.57, 2);
  });

  it('counts at least the driver and the booking\'s own seats as on board', () => {
    expect(co2SavedKg({ legKm: 10, vehicleType: 'sedan', seats: 2, onBoard: 1 })).toBe(
      co2SavedKg({ legKm: 10, vehicleType: 'sedan', seats: 2, onBoard: 3 }),
    );
  });

  it('is never negative, and nothing for no distance', () => {
    config.carbon.kgPerKm.testTruck = 0.5;
    try {
      expect(co2SavedKg({ legKm: 10, vehicleType: 'testTruck', seats: 1, onBoard: 2 })).toBe(0);
    } finally {
      delete config.carbon.kgPerKm.testTruck;
    }
    expect(co2SavedKg({ legKm: 0, vehicleType: 'sedan', seats: 1, onBoard: 2 })).toBe(0);
  });

  it('treats an unknown vehicle class as an average car', () => {
    expect(co2SavedKg({ legKm: 10, vehicleType: 'hovercraft', seats: 1, onBoard: 2 })).toBe(0.85);
  });
});

describe('the rider\'s leg', () => {
  // An L-shaped route: 0.1° north, then 0.1° east (about 11 km each way at the equator)
  const A = { lat: 0, lng: 0 };
  const B = { lat: 0.1, lng: 0 };
  const C = { lat: 0.1, lng: 0.1 };
  const ride = { routePolyline: encodePolyline([A, B, C]), pickup: point(A.lat, A.lng), dropoff: point(C.lat, C.lng) };

  it('is measured along the route, not as the crow flies', () => {
    expect(legDistanceKm(ride, point(0, 0), point(0.1, 0.1))).toBeCloseTo(22.3, 0);
  });

  it('covers only the part of the route the rider is on', () => {
    expect(legDistanceKm(ride, point(0.05, 0), point(0.1, 0.05))).toBeCloseTo(11.1, 0);
  });

  it('falls back to the straight line when the route gives a shorter distance', () => {
    // Pickup after the drop along the route: never counted as zero or negative
    expect(legDistanceKm(ride, point(0.1, 0.1), point(0, 0))).toBeCloseTo(15.7, 0);
  });
});

describe('recorded on completion (real MongoDB)', () => {
  let mongo: MongoMemoryServer;
  const driverId = new Types.ObjectId();
  const riderId = new Types.ObjectId();
  const otherRiderId = new Types.ObjectId();
  const vehicleId = new Types.ObjectId();
  const FROM = { lat: -17.83, lng: 31.05 };
  const TO = { lat: -17.78, lng: 31.1 };

  async function rideInProgress() {
    const departure = new Date(Date.now() - 600_000);
    return Ride.create({
      driver: driverId,
      status: RideStatus.IN_PROGRESS,
      vehicle: { vehicleId, vehicleType: 'sedan', hasAC: true, plateNumber: 'AEA 1234' },
      pickup: point(FROM.lat, FROM.lng),
      dropoff: point(TO.lat, TO.lng),
      routePolyline: encodePolyline([FROM, TO]),
      departureTime: departure,
      estimatedArrivalTime: new Date(departure.getTime() + 1800_000),
      estimatedDurationMins: 30,
      estimatedDistanceKm: 8,
      pricePerSeat: 2,
      availableSeats: 1,
      totalSeats: 3,
    });
  }

  function confirmedBooking(rideId: Types.ObjectId, rider: Types.ObjectId, seats = 1) {
    return Booking.create({
      ride: rideId, rider, driver: driverId, status: BookingStatus.CONFIRMED, seatsBooked: seats,
      pickup: point(FROM.lat, FROM.lng), dropoff: point(TO.lat, TO.lng), estimatedFare: 2 * seats,
    });
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
    await Promise.all([Ride.deleteMany({}), Booking.deleteMany({}), User.deleteMany({})]);
    await User.collection.insertMany([
      { _id: driverId, name: 'Nyasha Chuma', phone: '+263771000003', capabilities: ['rider', 'driver'], stats: {} },
      { _id: riderId, name: 'Rudo Moyo', phone: '+263771000001', capabilities: ['rider'], stats: {} },
      { _id: otherRiderId, name: 'Farai Dube', phone: '+263771000002', capabilities: ['rider'], stats: {} },
    ]);
  });

  it('stores the leg and the saving on the booking, and adds them to both users', async () => {
    const ride = await rideInProgress();
    const mine = await confirmedBooking(ride._id, riderId);
    await confirmedBooking(ride._id, otherRiderId);

    const done = await new BookingService().completeBooking(mine.id, driverId.toString());

    // About 7.7 km straight, the driver and two riders on board
    expect(done.distanceKm).toBeCloseTo(7.7, 0);
    const expected = co2SavedKg({ legKm: done.distanceKm!, vehicleType: 'sedan', seats: 1, onBoard: 3 });
    expect(done.co2SavedKg).toBe(expected);
    expect(expected).toBeGreaterThan(0);

    const [rider, driver] = await Promise.all([User.findById(riderId).lean(), User.findById(driverId).lean()]);
    expect(rider!.stats.co2SavedKg).toBe(expected);
    expect(rider!.stats.kmShared).toBe(done.distanceKm);
    expect(driver!.stats.co2SavedKg).toBe(expected);
  });

  it('gives each user their impact, this month and by month, and admins the platform total', async () => {
    const ride = await rideInProgress();
    const a = await confirmedBooking(ride._id, riderId);
    const b = await confirmedBooking(ride._id, otherRiderId);
    const service = new BookingService();
    const first = await service.completeBooking(a.id, driverId.toString());
    const second = await service.completeBooking(b.id, driverId.toString());

    const carbon = new CarbonService();
    const rider = await carbon.impact(riderId.toString());
    expect(rider.allTime).toEqual({ co2SavedKg: Math.round(first.co2SavedKg! * 10) / 10, kmShared: first.distanceKm, trips: 1 });
    expect(rider.thisMonth.trips).toBe(1);
    expect(rider.months).toHaveLength(6);
    expect(rider.months.slice(0, 5).every((m) => m.trips === 0)).toBe(true);
    expect(rider.method.baselineKgPerKm).toBe(config.carbon.baselineKgPerKm);

    const driver = await carbon.impact(driverId.toString());
    expect(driver.allTime.trips).toBe(2);
    expect(driver.allTime.co2SavedKg).toBeCloseTo(first.co2SavedKg! + second.co2SavedKg!, 1);

    expect((await carbon.platformTotal()).trips).toBe(2);
  });

  it('puts the saving on the completed trip\'s receipt', async () => {
    const ride = await rideInProgress();
    const mine = await confirmedBooking(ride._id, riderId);
    const done = await new BookingService().completeBooking(mine.id, driverId.toString());

    const { ReceiptService } = jest.requireActual<typeof import('../../services/ReceiptService')>('../../services/ReceiptService');
    const receipts = new ReceiptService();
    const receipt = await receipts.build(mine.id, riderId.toString());
    expect(receipt.co2SavedKg).toBe(done.co2SavedKg);
    expect(receipts.text(receipt)).toContain('kg of CO₂');
    expect(receipts.html(receipt)).toContain('CO₂ saved by sharing (estimate)');
  });

  it('shows nothing for a user with no shared trips yet', async () => {
    const impact = await new CarbonService().impact(new Types.ObjectId().toString());
    expect(impact.allTime).toEqual({ co2SavedKg: 0, kmShared: 0, trips: 0 });
    expect(impact.months).toHaveLength(6);
  });

  it('backfills bookings completed before it was counted, once', async () => {
    const ride = await rideInProgress();
    const old = await confirmedBooking(ride._id, riderId);
    await Booking.updateOne({ _id: old._id }, { $set: { status: BookingStatus.COMPLETED, actualDropoffTime: new Date() } });

    const carbon = new CarbonService();
    expect(await carbon.backfill()).toEqual({ measured: 1 });
    expect(await carbon.backfill()).toEqual({ measured: 0 });

    const booking = await Booking.findById(old._id).lean();
    expect(booking!.co2SavedKg).toBeGreaterThan(0);
    const rider = await User.findById(riderId).lean();
    expect(rider!.stats.co2SavedKg).toBe(booking!.co2SavedKg);
  });
});
