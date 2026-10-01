/**
 * Every phone on a ride, against a real MongoDB (decided 30 September 2026):
 * the car and each rider are traced while the ride is under way, kept 30
 * days or for good once an incident is attached, and an SOS sees all of
 * them, so a driver robbed by a rider is covered as much as the reverse.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
jest.mock('../../config/redis', () => ({ getRedisClient: () => null }));
jest.mock('../../services/SafetyAlerts', () => ({
  pageSafetyTeam: jest.fn().mockResolvedValue({ push: 1, sms: 1 }),
  textPeople: jest.fn(async (phones: string[]) => phones),
  pushToPhones: jest.fn().mockResolvedValue(undefined),
  pushAdmins: jest.fn().mockResolvedValue(undefined),
  smsAvailable: () => true,
  tellUser: jest.fn().mockResolvedValue(undefined),
}));
const mockEmit = jest.fn();
const mockRelay = jest.fn().mockResolvedValue(undefined);
jest.mock('../../sockets/SocketGateway', () => ({
  SocketGateway: {
    getInstance: () => ({ getIO: () => ({ to: () => ({ emit: mockEmit }) }), handleDriverLocationUpdate: mockRelay }),
  },
}));

import { Ride } from '../../models/Ride';
import { Booking } from '../../models/Booking';
import { User } from '../../models/User';
import { TripPosition } from '../../models/TripPosition';
import { EmergencyRecord } from '../../models/EmergencyRecord';
import { GatewayCharge } from '../../models/GatewayCharge';
import { receiveTripPosition } from '../../services/TripTrailService';
import { SafetyService, batteryReading } from '../../services/SafetyService';
import { AdminSosService } from '../../services/AdminSosService';
import { BookingStatus, RideStatus, SOSRiskLevel } from '../../types';
import { config } from '../../config';

jest.setTimeout(60_000);

const MIN = 60_000;
let mongo: MongoMemoryServer;
let clock = Date.now();
const safety = new SafetyService();
const riderId = new Types.ObjectId();
const otherRiderId = new Types.ObjectId();
const driverId = new Types.ObjectId();
const strangerId = new Types.ObjectId();
const vehicleId = new Types.ObjectId();
const at = (lat: number, lng: number) => ({ lat, lng });

async function ride(status = RideStatus.IN_PROGRESS) {
  const departure = new Date(clock - 10 * MIN);
  return Ride.create({
    driver: driverId, status, startedAt: departure,
    vehicle: { vehicleId, vehicleType: 'sedan', hasAC: true, plateNumber: 'AEA 1234' },
    pickup: { location: { type: 'Point', coordinates: [31.05, -17.83] }, address: 'Avondale' },
    dropoff: { location: { type: 'Point', coordinates: [31.10, -17.80] }, address: 'Borrowdale' },
    departureTime: departure, estimatedArrivalTime: new Date(departure.getTime() + 30 * MIN),
    estimatedDurationMins: 30, estimatedDistanceKm: 9, routePolyline: '',
    pricePerSeat: 2, availableSeats: 1, totalSeats: 3,
  });
}

function booking(rideId: Types.ObjectId, rider: Types.ObjectId, extra: Record<string, unknown> = {}) {
  return Booking.create({
    ride: rideId, rider, driver: driverId, status: BookingStatus.CONFIRMED, seatsBooked: 1, estimatedFare: 2,
    pickup: { location: { type: 'Point', coordinates: [31.051, -17.831] }, address: 'Avondale shops' },
    dropoff: { location: { type: 'Point', coordinates: [31.101, -17.801] }, address: 'Sam Levy Village' },
    ...extra,
  });
}

/** Moves the clock on, past the 15-second storing interval */
function later(ms = 16_000) {
  clock += ms;
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  jest.clearAllMocks();
  later(MIN);
  await mongoose.connection.db!.dropDatabase();
  await EmergencyRecord.createIndexes();
  await User.collection.insertMany([
    { _id: riderId, name: 'Rudo Moyo', phone: '+263771000001', capabilities: ['rider'], stats: {} },
    { _id: otherRiderId, name: 'Farai Dube', phone: '+263771000005', capabilities: ['rider'], stats: {} },
    {
      _id: driverId, name: 'Tafadzwa Ncube', phone: '+263771000002', capabilities: ['rider', 'driver'], stats: {},
      kyc: { status: 'approved', licenseNumber: '123456AB' },
      vehicles: [{ _id: vehicleId, make: 'Toyota', model: 'Corolla', color: 'White', year: 2016, plateNumber: 'AEA 1234', vehicleType: 'sedan', registrationDocUrl: 'x', insuranceDocUrl: 'y' }],
    },
    { _id: strangerId, name: 'Someone', phone: '+263771000004', capabilities: ['rider'], stats: {} },
  ]);
});

describe('the trip trail', () => {
  it('stores the car every 15 seconds for 30 days, and tells the phone to stop once the ride is over', async () => {
    const r = await ride();
    await booking(r._id, riderId, { actualPickupTime: new Date(clock) });

    expect(await receiveTripPosition(r.id, driverId.toString(), at(-17.82, 31.06), { battery: 0.8 })).toEqual({ tracking: true });
    expect(await receiveTripPosition(r.id, driverId.toString(), at(-17.821, 31.061))).toEqual({ tracking: true }); // 5 s later: not stored
    later();
    await receiveTripPosition(r.id, driverId.toString(), at(-17.81, 31.07));

    const points = await TripPosition.find({ ride: r._id }).sort({ at: 1 }).lean();
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ role: 'driver', battery: 0.8 });
    expect(Math.round((points[0].expiresAt!.getTime() - points[0].at.getTime()) / 86_400_000)).toBe(30);
    // Each rider's live map still gets the car
    expect(mockRelay).toHaveBeenCalledWith(driverId.toString(), expect.objectContaining({ location: at(-17.82, 31.06) }));

    await Ride.updateOne({ _id: r._id }, { status: RideStatus.COMPLETED });
    expect(await receiveTripPosition(r.id, driverId.toString(), at(-17.8, 31.1))).toEqual({ tracking: false });
  });

  it('traces a rider from pickup to drop only, and refuses anyone not on the ride', async () => {
    const r = await ride();
    const b = await booking(r._id, riderId);

    expect(await receiveTripPosition(r.id, riderId.toString(), at(-17.83, 31.05))).toEqual({ tracking: true });
    expect(await TripPosition.countDocuments({ user: riderId })).toBe(0); // not in the car yet

    await Booking.updateOne({ _id: b._id }, { actualPickupTime: new Date(clock) });
    later();
    await receiveTripPosition(r.id, riderId.toString(), at(-17.82, 31.06), { battery: 0.4 });
    expect(await TripPosition.findOne({ user: riderId }).lean()).toMatchObject({ role: 'rider', battery: 0.4 });

    await Booking.updateOne({ _id: b._id }, { actualDropoffTime: new Date(clock) });
    expect(await receiveTripPosition(r.id, riderId.toString(), at(-17.8, 31.1))).toEqual({ tracking: false });
    await expect(receiveTripPosition(r.id, strangerId.toString(), at(-17.8, 31.1))).rejects.toThrow('not on this ride');
  });
});

describe('an SOS sees every phone on the ride', () => {
  it('keeps the whole trail with the incident and relays the other phones live', async () => {
    const r = await ride();
    const b = await booking(r._id, riderId, { actualPickupTime: new Date(clock) });
    await receiveTripPosition(r.id, driverId.toString(), at(-17.82, 31.06));
    later();
    await receiveTripPosition(r.id, riderId.toString(), at(-17.82, 31.06));

    // The driver is the victim this time; the rider is who they are afraid of
    const sos = await safety.triggerSOS(driverId.toString(), { bookingId: b.id, location: at(-17.82, 31.06) });
    await new Promise((resolve) => setImmediate(resolve)); // keepTripTrail runs alongside
    expect(await TripPosition.countDocuments({ ride: r._id, expiresAt: { $exists: true } })).toBe(0);

    later();
    await receiveTripPosition(r.id, riderId.toString(), at(-17.81, 31.08));
    expect(await TripPosition.findOne({ user: riderId }).sort({ at: -1 }).lean()).not.toHaveProperty('expiresAt');
    expect(mockEmit).toHaveBeenCalledWith('sos:alert', expect.objectContaining({
      eventType: 'sos.trail',
      data: expect.objectContaining({ emergencyId: sos.id, userId: riderId.toString(), role: 'rider' }),
    }));
  });

  it('falls back to the car\'s stored position when the phone has none and the live one has gone', async () => {
    const r = await ride();
    const b = await booking(r._id, riderId, { actualPickupTime: new Date(clock) });
    await receiveTripPosition(r.id, driverId.toString(), at(-17.79, 31.09));
    const sos = await safety.triggerSOS(riderId.toString(), { bookingId: b.id });
    expect(sos.locationSource).toBe('ride');
    expect(sos.triggerLocation.coordinates).toEqual([31.09, -17.79]);
  });
});

describe('when a phone goes off', () => {
  it('says whether the battery ran out or it was switched off', async () => {
    expect(batteryReading(0.03)).toContain('probably run out');
    expect(batteryReading(0.6)).toContain('switched off, taken, or lost signal');
    expect(batteryReading(undefined)).toBe('Battery level unknown.');

    const r = await ride();
    const b = await booking(r._id, riderId, { actualPickupTime: new Date(clock) });
    const sos = await safety.triggerSOS(riderId.toString(), { bookingId: b.id, location: at(-17.82, 31.06) });
    await safety.updateSOSLocation(sos.id, riderId.toString(), at(-17.82, 31.06), 0.62);
    const quiet = config.safety.checkInSeconds.low * 1000;
    await safety.monitor(new Date(clock + 3 * quiet + 1000));

    const saved = await EmergencyRecord.findById(sos.id).lean();
    expect(saved?.lastBattery).toBe(0.62);
    expect(saved?.escalationReason).toContain('battery was at 62%: it was switched off');
  });
});

describe('"What\'s happening?"', () => {
  it('records who the danger is; naming someone on the ride raises the risk', async () => {
    const r = await ride();
    const b = await booking(r._id, riderId, { actualPickupTime: new Date(clock) });
    const sos = await safety.triggerSOS(riderId.toString(), { bookingId: b.id, location: at(-17.82, 31.06) });
    await expect(safety.setThreat(sos.id, driverId.toString(), 'medical')).rejects.toThrow('do not have access');
    const named = await safety.setThreat(sos.id, riderId.toString(), 'driver');
    expect(named).toMatchObject({ threat: 'driver', riskLevel: SOSRiskLevel.HIGH });
  });
});

describe('what the team sees to identify everyone', () => {
  it('has the car in full, the other riders, the money numbers, and every trail', async () => {
    const r = await ride();
    const b = await booking(r._id, riderId, { actualPickupTime: new Date(clock) });
    await booking(r._id, otherRiderId, { actualPickupTime: new Date(clock) });
    await GatewayCharge.collection.insertOne({ user: otherRiderId, phone: '+263772999888', channel: 'ecocash', purpose: 'booking', createdAt: new Date() });
    await receiveTripPosition(r.id, driverId.toString(), at(-17.82, 31.06));
    later();
    await receiveTripPosition(r.id, otherRiderId.toString(), at(-17.82, 31.06));

    const sos = await safety.triggerSOS(riderId.toString(), { bookingId: b.id, location: at(-17.82, 31.06) });
    const detail = await new AdminSosService().detail(sos.id) as unknown as {
      vehicle: Record<string, unknown>;
      coPassengers: Array<{ rider: { name: string; phone: string } }>;
      moneyNumbers: Record<string, Array<{ phone: string }>>;
      trails: Array<{ userId: string; role: string }>;
      driver: { kyc?: { licenseNumber?: string } };
    };

    expect(detail.vehicle).toMatchObject({ make: 'Toyota', model: 'Corolla', color: 'White', plateNumber: 'AEA 1234' });
    expect(detail.driver.kyc?.licenseNumber).toBe('123456AB');
    expect(detail.coPassengers.map((p) => p.rider.name)).toEqual(['Farai Dube']);
    expect(detail.moneyNumbers[otherRiderId.toString()]).toEqual([{ phone: '+263772999888', channel: 'ecocash' }]);
    expect(detail.trails.map((t) => t.role).sort()).toEqual(['driver', 'rider']);
  });
});
