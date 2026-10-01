/**
 * Car GPS trackers through the Traccar gateway (decided 1 October 2026),
 * against a real MongoDB: linking, positions kept only during a ride, the
 * panic button raising an SOS, tamper alarms, and the gateway's key.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
import request from 'supertest';

jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
jest.mock('../../config/redis', () => ({ getRedisClient: () => null }));
const mockPage = jest.fn().mockResolvedValue({ push: 1, sms: 1 });
jest.mock('../../services/SafetyAlerts', () => ({
  pageSafetyTeam: (...args: unknown[]) => mockPage(...args),
  textPeople: jest.fn(async (phones: string[]) => phones),
  pushToPhones: jest.fn().mockResolvedValue(undefined),
  pushAdmins: jest.fn().mockResolvedValue(undefined),
  smsAvailable: () => true,
  tellUser: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../sockets/SocketGateway', () => ({
  SocketGateway: { getInstance: () => ({ getIO: () => ({ to: () => ({ emit: jest.fn() }) }), handleDriverLocationUpdate: jest.fn() }) },
}));

import { Ride } from '../../models/Ride';
import { Booking } from '../../models/Booking';
import { User } from '../../models/User';
import { TripPosition } from '../../models/TripPosition';
import { EmergencyRecord } from '../../models/EmergencyRecord';
import { TrackerService, isTracked } from '../../services/TrackerService';
import { config } from '../../config';
import { BookingStatus, RideStatus } from '../../types';
import trackerRoutes from '../../routes/tracker.routes';

jest.setTimeout(60_000);

const MIN = 60_000;
const IMEI = '359339075012345';
let mongo: MongoMemoryServer;
const trackers = new TrackerService();
const driverId = new Types.ObjectId();
const otherDriverId = new Types.ObjectId();
const riderId = new Types.ObjectId();
const vehicleId = new Types.ObjectId();
const otherVehicleId = new Types.ObjectId();

const car = (_id: Types.ObjectId, plate: string) => ({
  _id, make: 'Toyota', model: 'Corolla', color: 'White', year: 2016, plateNumber: plate, vehicleType: 'sedan', registrationDocUrl: 'x', insuranceDocUrl: 'y',
});

/** What Traccar posts (forward.type=json) */
const fromGateway = (alarm?: string, lat = -17.82, lng = 31.06) => ({
  device: { uniqueId: IMEI, name: 'AEA 1234' },
  position: { latitude: lat, longitude: lng, speed: 10, valid: true, fixTime: new Date().toISOString(), attributes: { batteryLevel: 87, ...(alarm ? { alarm } : {}) } },
});

async function rideNow(status = RideStatus.IN_PROGRESS) {
  const departure = new Date(Date.now() - 10 * MIN);
  const ride = await Ride.create({
    driver: driverId, status,
    vehicle: { vehicleId, vehicleType: 'sedan', hasAC: true, plateNumber: 'AEA 1234' },
    pickup: { location: { type: 'Point', coordinates: [31.05, -17.83] }, address: 'Avondale' },
    dropoff: { location: { type: 'Point', coordinates: [31.10, -17.80] }, address: 'Borrowdale' },
    departureTime: departure, estimatedArrivalTime: new Date(departure.getTime() + 30 * MIN),
    estimatedDurationMins: 30, estimatedDistanceKm: 9, routePolyline: '',
    pricePerSeat: 2, availableSeats: 2, totalSeats: 3,
  });
  const booking = await Booking.create({
    ride: ride._id, rider: riderId, driver: driverId, status: BookingStatus.CONFIRMED, seatsBooked: 1, estimatedFare: 2,
    pickup: { location: { type: 'Point', coordinates: [31.051, -17.831] }, address: 'Avondale shops' },
    dropoff: { location: { type: 'Point', coordinates: [31.101, -17.801] }, address: 'Sam Levy Village' },
    actualPickupTime: new Date(),
  });
  return { ride, booking };
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
  jest.clearAllMocks();
  await mongoose.connection.db!.dropDatabase();
  await Promise.all([User.createIndexes(), EmergencyRecord.createIndexes()]);
  await User.collection.insertMany([
    { _id: driverId, name: 'Tafadzwa Ncube', phone: '+263771000002', capabilities: ['rider', 'driver'], stats: {}, vehicles: [car(vehicleId, 'AEA 1234')],
      emergencyContacts: [{ _id: new Types.ObjectId(), name: 'Mai Tafadzwa', phone: '+263772000003', relation: 'wife', notifyOnSos: true }] },
    { _id: otherDriverId, name: 'Other Driver', phone: '+263771000006', capabilities: ['rider', 'driver'], stats: {}, vehicles: [car(otherVehicleId, 'ABC 9876')] },
    { _id: riderId, name: 'Rudo Moyo', phone: '+263771000001', capabilities: ['rider'], stats: {} },
  ]);
});

describe('linking a tracker', () => {
  it('takes a device id, refuses nonsense, and one tracker can be in only one car', async () => {
    await expect(trackers.link(driverId.toString(), vehicleId.toString(), 'abc')).rejects.toThrow('device id');
    const status = await trackers.link(driverId.toString(), vehicleId.toString(), '3593 3907 5012 345');
    expect(status.vehicles[0].tracker).toMatchObject({ deviceId: IMEI, tracked: false });
    await expect(trackers.link(otherDriverId.toString(), otherVehicleId.toString(), IMEI)).rejects.toMatchObject({ statusCode: 409 });
    await expect(trackers.link(driverId.toString(), otherVehicleId.toString(), '359339075099999')).rejects.toThrow('Vehicle');
    await trackers.unlink(driverId.toString(), vehicleId.toString());
    expect((await trackers.status(driverId.toString())).vehicles[0].tracker).toBeNull();
  });
});

describe('positions from the gateway', () => {
  beforeEach(() => trackers.link(driverId.toString(), vehicleId.toString(), IMEI));

  it('keeps nothing about where the car is outside a ride, only that it reported', async () => {
    expect(await trackers.receive({ device: { uniqueId: '000000000000' }, position: { latitude: 1, longitude: 1 } })).toBe('unknown');
    expect(await trackers.receive(fromGateway())).toBe('ignored');
    expect(await TripPosition.countDocuments()).toBe(0);
    const v = (await User.findById(driverId).lean())!.vehicles[0];
    expect(isTracked(v.tracker)).toBe(true);
  });

  it('keeps the car\'s own trail during a ride, apart from the driver\'s phone', async () => {
    const { ride } = await rideNow();
    expect(await trackers.receive(fromGateway())).toBe('stored');
    const point = await TripPosition.findOne({ ride: ride._id }).lean();
    expect(point).toMatchObject({ role: 'vehicle', battery: 0.87 });
    expect(point?.speed).toBeCloseTo(18.52);
  });

  it('a panic button press during a ride raises the driver\'s SOS on the rider\'s booking, once', async () => {
    const { booking } = await rideNow();
    await trackers.receive(fromGateway('sos'));
    await trackers.receive(fromGateway('sos')); // trackers repeat the alarm
    const records = await EmergencyRecord.find().lean();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ raisedVia: 'tracker', contactsState: 'pending' });
    expect(String(records[0].booking)).toBe(booking.id);
    expect(String(records[0].triggeredBy)).toBe(driverId.toString());
    expect(mockPage).toHaveBeenCalledWith(String(records[0]._id), expect.stringContaining('panic button in car AEA 1234 was pressed'));
  });

  it('a cut tracker during an open SOS goes on the incident and pages the team', async () => {
    await rideNow();
    await trackers.receive(fromGateway('sos'));
    jest.clearAllMocks();
    await trackers.receive(fromGateway('powerCut'));
    const record = await EmergencyRecord.findOne().lean();
    expect(record?.timeline.at(-1)).toMatchObject({ event: 'Car tracker alarm', details: 'The tracker in AEA 1234 lost power' });
    expect(mockPage).toHaveBeenCalledWith(String(record!._id), expect.stringContaining('lost power'));
  });
});

describe('the gateway endpoint', () => {
  const app = express().use(express.json()).use('/trackers', trackerRoutes);
  const original = config.trackers.gatewayKey;
  afterEach(() => { (config.trackers as { gatewayKey: string }).gatewayKey = original; });

  it('is off without a key, and refuses a wrong one', async () => {
    (config.trackers as { gatewayKey: string }).gatewayKey = '';
    expect((await request(app).post('/trackers/traccar').send(fromGateway())).status).toBe(404);
    (config.trackers as { gatewayKey: string }).gatewayKey = 'gateway-secret';
    expect((await request(app).post('/trackers/traccar').set('X-Poolora-Tracker-Key', 'wrong').send(fromGateway())).status).toBe(401);
    const ok = await request(app).post('/trackers/traccar').set('X-Poolora-Tracker-Key', 'gateway-secret').send(fromGateway());
    expect(ok.status).toBe(200);
    expect(ok.body.result).toBe('unknown'); // nothing linked in this test
  });
});
