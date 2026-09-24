/**
 * Posting a ride (UC-D02): at least 2 hours ahead, at most 300 km, a seat
 * price within ₹2-₹15 a km and ±30% of the suggestion, surge when demand is
 * high, and up to three stops.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
const mockGetRoute = jest.fn();
jest.mock('../../services/MapsService', () => ({ getRoute: (...a: unknown[]) => mockGetRoute(...a) }));
const mockPredict = jest.fn();
jest.mock('../../utils/mlClient', () => ({ mlClient: { post: (...a: unknown[]) => mockPredict(...a) } }));
jest.mock('../../services/RideAlertService', () => ({ RideAlertService: jest.fn().mockImplementation(() => ({ notifyMatches: jest.fn() })) }));

import { User } from '../../models/User';
import { RideService } from '../../services/RideService';
import { PricingService } from '../../services/PricingService';
import { RecurringPattern, RideType } from '../../types';

jest.setTimeout(60_000);

const HOUR = 3_600_000;
let mongo: MongoMemoryServer;
const driverId = new Types.ObjectId();
const vehicleId = new Types.ObjectId();
const rides = new RideService();

function ride(overrides: Record<string, unknown> = {}) {
  return {
    rideType: RideType.CAR_POOL,
    vehicleId: vehicleId.toString(),
    pickup: { lng: 77.6, lat: 12.97, address: 'Indiranagar' },
    dropoff: { lng: 77.7, lat: 12.96, address: 'Marathahalli' },
    departureTime: new Date(Date.now() + 5 * HOUR).toISOString(),
    totalSeats: 3,
    pricePerSeat: 80,
    recurring: RecurringPattern.NONE,
    preferences: {} as never,
    ...overrides,
  };
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await User.collection.insertOne({
    _id: driverId, name: 'Ravi', phone: '+919000000002', capabilities: ['rider', 'driver'], kyc: { status: 'approved' }, stats: {},
    vehicles: [{ _id: vehicleId, make: 'Maruti', model: 'Dzire', color: 'White', year: 2021, plateNumber: 'KA05MN1234', vehicleType: 'sedan' }],
  });
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(() => {
  mockGetRoute.mockReset().mockResolvedValue({ distanceKm: 20, durationMins: 40, polyline: '' });
  mockPredict.mockReset().mockRejectedValue(new Error('ML service down'));
});

describe('price suggestions', () => {
  const at = (hourIst: number) => new Date(Date.UTC(2026, 9, 7, hourIst - 5, 30)); // a Wednesday, in India time

  it('suggests from distance and vehicle, with a ±30% band', async () => {
    const s = await new PricingService().suggest({ distanceKm: 20, vehicleType: 'sedan', departureTime: at(13), pickup: { lat: 12.97, lng: 77.6 } });
    expect(s).toMatchObject({ suggested: 80, min: 56, max: 104, surge: 1, peak: false });
  });

  it('adds 10% at commute hours and surge when demand is high, capped at +50%', async () => {
    mockPredict.mockResolvedValue({ data: { surge_multiplier: 2.2 } });
    const s = await new PricingService().suggest({ distanceKm: 20, vehicleType: 'sedan', departureTime: at(8), pickup: { lat: 12.97, lng: 77.6 } });
    expect(s.surge).toBe(1.5);
    expect(s.peak).toBe(true);
    expect(s.suggested).toBe(130); // 20 km × ₹4 × 1.1 × 1.5 = 132, to the nearest ₹5
    expect(s.explanation).toContain('high demand +50%');
  });

  it('ignores a small surge below +20%', async () => {
    mockPredict.mockResolvedValue({ data: { surge_multiplier: 1.1 } });
    const s = await new PricingService().suggest({ distanceKm: 20, departureTime: at(13), pickup: { lat: 12.97, lng: 77.6 } });
    expect(s.surge).toBe(1);
  });

  it('never goes below ₹2 or above ₹15 a km', async () => {
    const s = await new PricingService().suggest({ distanceKm: 100, vehicleType: 'bike', departureTime: at(13), pickup: { lat: 12.97, lng: 77.6 } });
    expect(s.min).toBeGreaterThanOrEqual(200);
    expect(s.max).toBeLessThanOrEqual(1500);
  });
});

describe('posting a ride', () => {
  it('needs 2 hours notice', async () => {
    await expect(rides.createRide(driverId.toString(), ride({ departureTime: new Date(Date.now() + HOUR).toISOString() }))).rejects.toThrow('at least 2 hours');
  });

  it('refuses rides over 300 km', async () => {
    mockGetRoute.mockResolvedValue({ distanceKm: 340, durationMins: 360, polyline: '' });
    await expect(rides.createRide(driverId.toString(), ride({ pricePerSeat: 1400 }))).rejects.toThrow('at most 300 km');
  });

  it('keeps the price within the band around the suggestion', async () => {
    await expect(rides.createRide(driverId.toString(), ride({ pricePerSeat: 500 }))).rejects.toMatchObject({ errorId: 'PRICE_OUT_OF_RANGE' });
    const created = await rides.createRide(driverId.toString(), ride({ pricePerSeat: 90 }));
    expect(created.pricePerSeat).toBe(90);
  });

  it('routes through stops in order and stores them', async () => {
    const stops = [{ lng: 77.64, lat: 12.97, address: 'Domlur' }, { lng: 77.67, lat: 12.96, address: 'HAL' }];
    const created = await rides.createRide(driverId.toString(), ride({ waypoints: stops }));
    expect(mockGetRoute).toHaveBeenCalledWith(expect.anything(), expect.anything(), stops);
    expect(created.waypoints.map((w) => w.address)).toEqual(['Domlur', 'HAL']);
  });

  it('lets the simulator skip the rules', async () => {
    const created = await rides.createRide(driverId.toString(), ride({ departureTime: new Date(Date.now() + 5 * 60_000).toISOString(), pricePerSeat: 1 }), { skipCreationRules: true });
    expect(created.pricePerSeat).toBe(1);
  });
});
