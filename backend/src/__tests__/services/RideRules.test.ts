/**
 * Posting a ride (UC-D02): at least 2 hours ahead, at most 650 km, a seat
 * price within US$0.02-US$0.20 a km and ±30% of the suggestion, surge when demand is
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
    pickup: { lng: 31.04, lat: -17.8, address: 'Avondale' },
    dropoff: { lng: 31.1, lat: -17.75, address: 'Borrowdale' },
    departureTime: new Date(Date.now() + 5 * HOUR).toISOString(),
    totalSeats: 3,
    pricePerSeat: 1.2,
    recurring: RecurringPattern.NONE,
    preferences: {} as never,
    ...overrides,
  };
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await User.collection.insertOne({
    _id: driverId, name: 'Tendai', phone: '+263771000002', capabilities: ['rider', 'driver'], kyc: { status: 'approved' }, stats: {},
    vehicles: [{ _id: vehicleId, make: 'Toyota', model: 'Axio', color: 'White', year: 2016, plateNumber: 'AEA1234', vehicleType: 'sedan' }],
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
  const at = (hourLocal: number) => new Date(Date.UTC(2026, 9, 7, hourLocal - 2, 30)); // a Wednesday, in Zimbabwe time

  it('suggests from distance and vehicle, with a ±30% band', async () => {
    const s = await new PricingService().suggest({ distanceKm: 20, vehicleType: 'sedan', departureTime: at(13), pickup: { lat: -17.8, lng: 31.04 } });
    expect(s).toMatchObject({ suggested: 1.2, min: 0.9, max: 1.5, surge: 1, peak: false }); // 20 km × US$0.06
  });

  it('adds 10% at commute hours and surge when demand is high, capped at +50%', async () => {
    mockPredict.mockResolvedValue({ data: { surge_multiplier: 2.2 } });
    const s = await new PricingService().suggest({ distanceKm: 20, vehicleType: 'sedan', departureTime: at(8), pickup: { lat: -17.8, lng: 31.04 } });
    expect(s.surge).toBe(1.5);
    expect(s.peak).toBe(true);
    expect(s.suggested).toBe(2); // 20 km × US$0.06 × 1.1 × 1.5 = 1.98, to the nearest 10 cents
    expect(s.explanation).toContain('high demand +50%');
  });

  it('ignores a small surge below +20%', async () => {
    mockPredict.mockResolvedValue({ data: { surge_multiplier: 1.1 } });
    const s = await new PricingService().suggest({ distanceKm: 20, departureTime: at(13), pickup: { lat: -17.8, lng: 31.04 } });
    expect(s.surge).toBe(1);
  });

  it('never goes below US$0.02 or above US$0.20 a km', async () => {
    const s = await new PricingService().suggest({ distanceKm: 100, vehicleType: 'bike', departureTime: at(13), pickup: { lat: -17.8, lng: 31.04 } });
    expect(s.min).toBeGreaterThanOrEqual(2);
    expect(s.max).toBeLessThanOrEqual(20);
  });
});

describe('posting a ride', () => {
  it('needs 2 hours notice', async () => {
    await expect(rides.createRide(driverId.toString(), ride({ departureTime: new Date(Date.now() + HOUR).toISOString() }))).rejects.toThrow('at least 2 hours');
  });

  it('refuses rides over 650 km', async () => {
    mockGetRoute.mockResolvedValue({ distanceKm: 700, durationMins: 540, polyline: '' });
    await expect(rides.createRide(driverId.toString(), ride({ pricePerSeat: 20 }))).rejects.toThrow('at most 650 km');
  });

  it('keeps the price within the band around the suggestion', async () => {
    await expect(rides.createRide(driverId.toString(), ride({ pricePerSeat: 5 }))).rejects.toMatchObject({ errorId: 'PRICE_OUT_OF_RANGE' });
    const created = await rides.createRide(driverId.toString(), ride({ pricePerSeat: 1.3 }));
    expect(created.pricePerSeat).toBe(1.3);
  });

  it('routes through stops in order and stores them', async () => {
    const stops = [{ lng: 31.06, lat: -17.78, address: 'Mount Pleasant' }, { lng: 31.08, lat: -17.76, address: 'Groombridge' }];
    const created = await rides.createRide(driverId.toString(), ride({ waypoints: stops }));
    expect(mockGetRoute).toHaveBeenCalledWith(expect.anything(), expect.anything(), stops);
    expect(created.waypoints.map((w) => w.address)).toEqual(['Mount Pleasant', 'Groombridge']);
  });

  it('lets the simulator skip the rules', async () => {
    const created = await rides.createRide(driverId.toString(), ride({ departureTime: new Date(Date.now() + 5 * 60_000).toISOString(), pricePerSeat: 1 }), { skipCreationRules: true });
    expect(created.pricePerSeat).toBe(1);
  });
});
