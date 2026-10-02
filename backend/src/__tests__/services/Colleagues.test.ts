/**
 * Colleagues-only rides and the "Works at" badge (UC-C02), against a real
 * MongoDB. Only staff of the driver's company, while its programme is
 * active, see, book or hear about a colleagues-only ride, and only
 * colleagues see where someone works.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
jest.mock('../../services/MapsService', () => ({ getRoute: jest.fn() }));
jest.mock('../../services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendPushNotification: jest.fn().mockResolvedValue(undefined),
    createNotification: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { Organisation } from '../../models/Organisation';
import { Ride } from '../../models/Ride';
import { User } from '../../models/User';
import { Booking } from '../../models/Booking';
import { RideAlert } from '../../models/RideAlert';
import { RideService } from '../../services/RideService';
import { BookingService } from '../../services/BookingService';
import { RideAlertService } from '../../services/RideAlertService';
import { encodePolyline } from '../../utils/routeGeometry';
import { RideStatus } from '../../types';

jest.setTimeout(60_000);

const FROM = { lat: -17.83, lng: 31.05 };
const TO = { lat: -17.78, lng: 31.1 };
const departure = new Date(Date.now() + 3 * 3600_000);

let mongo: MongoMemoryServer;
const rides = new RideService();
const bookings = new BookingService();
const driverId = new Types.ObjectId();
const colleagueId = new Types.ObjectId();
const outsiderId = new Types.ObjectId();
const otherCompanyId = new Types.ObjectId();
const vehicleId = new Types.ObjectId();
let econet: Types.ObjectId;
let delta: Types.ObjectId;

const work = (organisation: Types.ObjectId, email: string) => ({ organisation, email, verifiedAt: new Date() });

async function ride(colleaguesOnly: boolean) {
  return Ride.create({
    driver: driverId,
    status: RideStatus.SCHEDULED,
    vehicle: { vehicleId, vehicleType: 'sedan', hasAC: true, plateNumber: 'AEA 1234' },
    pickup: { location: { type: 'Point', coordinates: [FROM.lng, FROM.lat] }, address: 'Avondale' },
    dropoff: { location: { type: 'Point', coordinates: [TO.lng, TO.lat] }, address: 'Borrowdale' },
    routePolyline: encodePolyline([FROM, TO]),
    departureTime: departure,
    estimatedArrivalTime: new Date(departure.getTime() + 1800_000),
    estimatedDurationMins: 30,
    estimatedDistanceKm: 8,
    pricePerSeat: 1,
    availableSeats: 3,
    totalSeats: 3,
    preferences: { colleaguesOnly },
    ...(colleaguesOnly ? { organisation: econet } : {}),
  });
}

const search = (userId: Types.ObjectId) =>
  rides.searchRides(userId.toString(), { pickupLat: FROM.lat, pickupLng: FROM.lng, dropoffLat: TO.lat, dropoffLng: TO.lng, departureTime: departure, radiusKm: 3 }, 1, 20);

const book = (userId: Types.ObjectId, rideId: string) =>
  bookings.createBooking(userId.toString(), {
    rideId, seatsBooked: 1,
    pickup: { ...FROM, address: 'Avondale' },
    dropoff: { ...TO, address: 'Borrowdale' },
  } as never);

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([Ride.init(), User.init(), Organisation.init(), RideAlert.init()]);
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  await Promise.all([Ride.deleteMany({}), User.deleteMany({}), Organisation.deleteMany({}), Booking.deleteMany({}), RideAlert.deleteMany({})]);
  const admin = new Types.ObjectId();
  const contact = { name: 'Accounts', email: 'accounts@example.co.zw' };
  econet = (await Organisation.create({ name: 'Econet', domains: ['econet.co.zw'], billingContact: contact, createdBy: admin }))._id;
  delta = (await Organisation.create({ name: 'Delta', domains: ['delta.co.zw'], billingContact: contact, createdBy: admin }))._id;
  await User.collection.insertMany([
    {
      _id: driverId, name: 'Nyasha Chuma', phone: '+263771000003', capabilities: ['rider', 'driver'], kyc: { status: 'approved' }, stats: {},
      work: work(econet, 'nyasha@econet.co.zw'),
      vehicles: [{ _id: vehicleId, make: 'Toyota', model: 'Corolla', color: 'White', year: 2016, plateNumber: 'AEA 1234', vehicleType: 'sedan', registrationDocUrl: 'x', insuranceDocUrl: 'y' }],
    },
    { _id: colleagueId, name: 'Rudo Moyo', phone: '+263771000001', capabilities: ['rider'], stats: {}, work: work(econet, 'rudo@econet.co.zw') },
    { _id: outsiderId, name: 'Farai Dube', phone: '+263771000002', capabilities: ['rider'], stats: {} },
    { _id: otherCompanyId, name: 'Tatenda Sibanda', phone: '+263771000004', capabilities: ['rider'], stats: {}, work: work(delta, 'tatenda@delta.co.zw') },
  ]);
});

describe('colleagues-only rides', () => {
  it('only staff of a company on Poolora can post one, and it belongs to their company', async () => {
    const post = (userId: Types.ObjectId) => rides.createRide(userId.toString(), {
      rideType: 'car_pool', vehicleId: vehicleId.toString(),
      pickup: { ...FROM, address: 'Avondale' }, dropoff: { ...TO, address: 'Borrowdale' },
      departureTime: departure.toISOString(), totalSeats: 3, pricePerSeat: 1, recurring: 'none',
      preferences: { colleaguesOnly: true } as never,
    } as never);

    const posted = await post(driverId);
    expect(String(posted.organisation)).toBe(String(econet));

    await User.updateOne({ _id: driverId }, { $unset: { work: 1 } });
    await expect(post(driverId)).rejects.toMatchObject({ statusCode: 403, errorId: 'NOT_A_COMPANY_MEMBER' });
  });

  it('is seen only by the driver\'s colleagues', async () => {
    await ride(true);
    expect((await search(colleagueId)).total).toBe(1);
    expect((await search(outsiderId)).total).toBe(0);
    expect((await search(otherCompanyId)).total).toBe(0);
  });

  it('cannot be booked by id from outside the company', async () => {
    const r = await ride(true);
    await expect(book(outsiderId, r.id)).rejects.toMatchObject({ statusCode: 403, errorId: 'COLLEAGUES_ONLY' });
    await expect(book(otherCompanyId, r.id)).rejects.toMatchObject({ errorId: 'COLLEAGUES_ONLY' });
    expect((await book(colleagueId, r.id)).booking).toBeDefined();
  });

  it('is hidden from everyone while the company is suspended', async () => {
    const r = await ride(true);
    await Organisation.updateOne({ _id: econet }, { $set: { status: 'suspended' } });
    expect((await search(colleagueId)).total).toBe(0);
    await expect(book(colleagueId, r.id)).rejects.toMatchObject({ errorId: 'COLLEAGUES_ONLY' });
  });

  it('is announced only to colleagues waiting on the route', async () => {
    const alerts = new RideAlertService();
    const stop = (p: { lat: number; lng: number }, address: string) => ({ ...p, address });
    for (const id of [colleagueId, outsiderId]) {
      await alerts.create(id.toString(), { pickup: stop(FROM, 'Avondale'), dropoff: stop(TO, 'Borrowdale') });
    }
    expect(await alerts.notifyMatches(await ride(true))).toBe(1);
    expect(await RideAlert.countDocuments({ rider: colleagueId, notifiedRides: { $size: 1 } })).toBe(1);
  });
});

describe('the "Works at" badge', () => {
  it('shows a colleague where the driver works, and nobody else', async () => {
    await ride(false);
    const forColleague = await search(colleagueId);
    expect(forColleague.items[0].driver).toMatchObject({ colleagueAt: 'Econet' });
    const forOutsider = await search(outsiderId);
    expect(forOutsider.items[0].driver).not.toHaveProperty('colleagueAt');
    // Never the work email, to anyone
    expect(JSON.stringify(forColleague.items)).not.toContain('econet.co.zw');
  });

  it('shows a driver which of their riders are colleagues', async () => {
    const r = await ride(false);
    await book(colleagueId, r.id);
    await book(outsiderId, r.id);
    const list = await bookings.getUserBookings(driverId.toString(), 'driver', undefined, 1, 20);
    const items = list.items as unknown as Array<{ rider: { name: string; colleagueAt?: string } }>;
    const byName = Object.fromEntries(items.map((b) => [b.rider.name, b.rider.colleagueAt]));
    expect(byName).toEqual({ 'Rudo Moyo': 'Econet', 'Farai Dube': undefined });
  });
});
