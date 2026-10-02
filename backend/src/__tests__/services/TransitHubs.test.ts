/**
 * Kombi ranks and bus termini (UC-R12), against a real MongoDB. Admins add
 * them, starting switched off so the pin is checked first; riders find the
 * switched-on ones first in place search, and a booking dropping them at a
 * bus terminus can carry the time their bus leaves.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
const mockGeocode = jest.fn();
jest.mock('../../services/MapsService', () => ({ getRoute: jest.fn(), geocodeAddress: (a: string) => mockGeocode(a) }));
jest.mock('../../services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendPushNotification: jest.fn().mockResolvedValue(undefined),
    createNotification: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { TransitHub } from '../../models/TransitHub';
import { Ride } from '../../models/Ride';
import { User } from '../../models/User';
import { Booking } from '../../models/Booking';
import { Wallet } from '../../models/Wallet';
import { TransitHubService } from '../../services/TransitHubService';
import { BookingService } from '../../services/BookingService';
import { encodePolyline } from '../../utils/routeGeometry';
import { RideStatus } from '../../types';

jest.setTimeout(60_000);

const MUSIKA = { lat: -17.86, lng: 31.038 };
const ROADPORT = { lat: -17.836, lng: 31.055 };
const HOME = { lat: -17.8, lng: 31.0 };

let mongo: MongoMemoryServer;
const hubs = new TransitHubService();
const bookings = new BookingService();
const adminId = new Types.ObjectId();
const driverId = new Types.ObjectId();
const riderId = new Types.ObjectId();
const vehicleId = new Types.ObjectId();

const add = (input: Record<string, unknown>) => hubs.create(input, adminId.toString());

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await TransitHub.init();
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  mockGeocode.mockReset();
  await Promise.all([TransitHub.deleteMany({}), Ride.deleteMany({}), User.deleteMany({}), Booking.deleteMany({}), Wallet.deleteMany({})]);
});

describe('adding ranks and termini', () => {
  it('finds a new one on the map, and keeps it switched off until checked', async () => {
    mockGeocode.mockResolvedValueOnce({ ...MUSIKA, formattedAddress: 'Mbare', placeId: 'x' });
    const { hub } = await add({ name: 'Mbare Musika', kind: 'bus_terminus', city: 'Harare', aliases: 'Musika, Mbare bus terminus' });
    expect(hub).toMatchObject({ name: 'Mbare Musika', active: false, lat: MUSIKA.lat, aliases: ['Musika', 'Mbare bus terminus'] });
    expect(mockGeocode).toHaveBeenCalledWith('Mbare Musika, Harare');
    // Added names drop out of the suggestions
    const { suggestions } = await hubs.list();
    expect(suggestions.map((s) => s.name)).not.toContain('Mbare Musika');
    expect(suggestions.map((s) => s.name)).toContain('Roadport');
  });

  it('refuses positions outside the market, duplicates, and places the map cannot find', async () => {
    await expect(add({ name: 'Park Station', kind: 'bus_terminus', city: 'Johannesburg', lat: -26.19, lng: 28.04 })).rejects.toMatchObject({ errorId: 'OUTSIDE_MARKET' });
    await add({ name: 'Roadport', kind: 'bus_terminus', city: 'Harare', ...ROADPORT });
    await expect(add({ name: 'Roadport', kind: 'bus_terminus', city: 'Harare', ...ROADPORT })).rejects.toThrow('already listed');
    mockGeocode.mockRejectedValueOnce(new Error('none'));
    await expect(add({ name: 'Nowhere Rank', kind: 'kombi_rank', city: 'Harare' })).rejects.toMatchObject({ errorId: 'HUB_NOT_FOUND' });
  });
});

describe('finding them', () => {
  beforeEach(async () => {
    await add({ name: 'Mbare Musika', kind: 'bus_terminus', city: 'Harare', aliases: ['Musika'], ...MUSIKA, active: true });
    await add({ name: 'Roadport', kind: 'bus_terminus', city: 'Harare', ...ROADPORT, active: true });
    await add({ name: 'Copacabana', kind: 'kombi_rank', city: 'Harare', lat: -17.832, lng: 31.046 });
  });

  it('matches switched-on ones by name or other name, at the start of a word', async () => {
    expect((await hubs.match('musika')).map((h) => h.mainText)).toEqual(['Mbare Musika']);
    expect((await hubs.match('road'))[0]).toMatchObject({ mainText: 'Roadport', secondaryText: 'Bus terminus · Harare', hub: 'bus_terminus', lat: ROADPORT.lat });
    expect(await hubs.match('copa')).toEqual([]); // still switched off
    expect(await hubs.match('ort')).toEqual([]); // not the start of a word
    expect(await hubs.match('ro')).toEqual([]); // too short
  });

  it('puts the nearest first', async () => {
    expect((await hubs.match('harare', ROADPORT)).map((h) => h.mainText)).toEqual(['Roadport', 'Mbare Musika']);
  });

  it('knows when a point is at one', async () => {
    expect((await hubs.at({ lat: MUSIKA.lat + 0.002, lng: MUSIKA.lng }))?.name).toBe('Mbare Musika');
    expect(await hubs.at(HOME)).toBeNull();
  });
});

describe('catching a bus from the drop', () => {
  const departure = new Date(Date.now() + 3 * 3_600_000);

  beforeEach(async () => {
    await add({ name: 'Mbare Musika', kind: 'bus_terminus', city: 'Harare', ...MUSIKA, active: true });
    await User.collection.insertMany([
      { _id: driverId, name: 'Nyasha Chuma', phone: '+263771000003', capabilities: ['rider', 'driver'], kyc: { status: 'approved' }, stats: {},
        vehicles: [{ _id: vehicleId, make: 'Toyota', model: 'Corolla', color: 'White', year: 2016, plateNumber: 'AEA 1234', vehicleType: 'sedan', registrationDocUrl: 'x', insuranceDocUrl: 'y' }] },
      { _id: riderId, name: 'Rudo Moyo', phone: '+263771000001', capabilities: ['rider'], stats: {} },
    ]);
    await Wallet.create({ userId: riderId, balance: 50 });
  });

  const ride = () => Ride.create({
    driver: driverId, status: RideStatus.SCHEDULED,
    vehicle: { vehicleId, vehicleType: 'sedan', hasAC: true, plateNumber: 'AEA 1234' },
    pickup: { location: { type: 'Point', coordinates: [HOME.lng, HOME.lat] }, address: 'Home' },
    dropoff: { location: { type: 'Point', coordinates: [MUSIKA.lng, MUSIKA.lat] }, address: 'Mbare Musika' },
    routePolyline: encodePolyline([HOME, MUSIKA]), departureTime: departure,
    estimatedArrivalTime: new Date(departure.getTime() + 1800_000), estimatedDurationMins: 30, estimatedDistanceKm: 8,
    pricePerSeat: 2, availableSeats: 3, totalSeats: 3,
  });
  const book = (rideId: string, departsAt?: Date) => bookings.createBooking(riderId.toString(), {
    rideId, seatsBooked: 1, useWallet: true,
    pickup: { ...HOME, address: 'Home' }, dropoff: { ...MUSIKA, address: 'Mbare Musika' },
    ...(departsAt ? { connection: { departsAt } } : {}),
  } as never);

  it('says so in the quote, and keeps the bus time and the terminus on the booking', async () => {
    const r = await ride();
    expect(await bookings.quote(riderId.toString(), { rideId: r.id, seatsBooked: 1, pickup: HOME, dropoff: MUSIKA })).toMatchObject({ dropoffHub: { name: 'Mbare Musika', kind: 'bus_terminus' } });
    const bus = new Date(departure.getTime() + 2 * 3_600_000);
    const { booking } = await book(r.id, bus);
    expect(booking.connection).toMatchObject({ departsAt: bus, hubName: 'Mbare Musika' });
  });

  it('refuses a bus that leaves before the ride, or a day later', async () => {
    const r = await ride();
    await expect(book(r.id, new Date(departure.getTime() - 60_000))).rejects.toMatchObject({ errorId: 'BAD_CONNECTION_TIME' });
    await expect(book(r.id, new Date(departure.getTime() + 25 * 3_600_000))).rejects.toMatchObject({ errorId: 'BAD_CONNECTION_TIME' });
  });
});
