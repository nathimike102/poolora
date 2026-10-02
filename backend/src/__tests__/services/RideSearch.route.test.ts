/**
 * Search along the route, against a real MongoDB: a rider is matched when the
 * ride's route passes near both their pickup and their drop, in that order,
 * even far from where the ride starts.
 *
 * The test route is L-shaped: east along 12.90°N from A to C, then north
 * along 77.60°E to D. Only the road polyline has that shape; a straight line
 * from A to D would cut the corner.
 *
 * Locally, set MONGOMS_SYSTEM_BINARY to an existing mongod to skip the download.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
jest.mock('../../services/MapsService', () => ({ getRoute: jest.fn() }));
const mockPush = jest.fn().mockResolvedValue(undefined);
jest.mock('../../services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({ sendPushNotification: mockPush, createNotification: jest.fn().mockResolvedValue(undefined) })),
}));

import { Ride } from '../../models/Ride';
import { User } from '../../models/User';
import { RideService } from '../../services/RideService';
import { backfillRouteLines } from '../../jobs/backfillRouteLines';
import { RideStatus } from '../../types';
import { RideAlertService } from '../../services/RideAlertService';
import { RideAlert } from '../../models/RideAlert';
import { inEnglish } from '../setup/english';

jest.setTimeout(60_000);

/** Google polyline encoding, the format OSRM and Google return. */
function encode(points: Array<[number, number]>): string {
  let out = '';
  let prevLat = 0;
  let prevLng = 0;
  const enc = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    let s = '';
    while (n >= 0x20) {
      s += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    return s + String.fromCharCode(n + 63);
  };
  for (const [lat, lng] of points) {
    const la = Math.round(lat * 1e5);
    const ln = Math.round(lng * 1e5);
    out += enc(la - prevLat) + enc(ln - prevLng);
    prevLat = la;
    prevLng = ln;
  }
  return out;
}

const A: [number, number] = [12.9, 77.5];
const C: [number, number] = [12.9, 77.6];
const D: [number, number] = [13.0, 77.6];
const departure = new Date(Date.now() + 3 * 3600_000);

let mongo: MongoMemoryServer;
const service = new RideService();
const riderId = new Types.ObjectId();
const driverId = new Types.ObjectId();

function rideDoc(extra: Record<string, unknown> = {}) {
  return {
    driver: driverId,
    status: RideStatus.SCHEDULED,
    vehicle: { vehicleId: new Types.ObjectId(), vehicleType: 'sedan', hasAC: true, plateNumber: 'KA01AB1234' },
    pickup: { location: { type: 'Point', coordinates: [A[1], A[0]] }, address: 'A' },
    dropoff: { location: { type: 'Point', coordinates: [D[1], D[0]] }, address: 'D' },
    routePolyline: encode([A, [12.9, 77.55], C, [12.95, 77.6], D]),
    departureTime: departure,
    estimatedArrivalTime: new Date(departure.getTime() + 3600_000),
    estimatedDurationMins: 60,
    estimatedDistanceKm: 22,
    pricePerSeat: 100,
    availableSeats: 3,
    totalSeats: 3,
    ...extra,
  };
}

function search(pickup: [number, number], dropoff: [number, number], radiusKm = 3) {
  return service.searchRides(
    riderId.toString(),
    {
      pickupLat: pickup[0],
      pickupLng: pickup[1],
      dropoffLat: dropoff[0],
      dropoffLng: dropoff[1],
      departureTime: departure,
      radiusKm,
    },
    1,
    20,
  );
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Ride.init(); // builds the 2dsphere indexes before the first $geoNear
  await User.collection.insertMany([
    { _id: riderId, name: 'Rider', phone: '+919000000001', gender: 'female', stats: {} },
    { _id: driverId, name: 'Driver', phone: '+919000000002', stats: { avgRatingAsDriver: 4.8 } },
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

beforeEach(async () => {
  await Ride.deleteMany({});
});

describe('search along the route', () => {
  it('stores the route as an indexed GeoJSON line when a ride is saved', async () => {
    const ride = await Ride.create(rideDoc());
    expect(ride.routeLine?.type).toBe('LineString');
    expect(ride.routeLine?.coordinates[0]).toEqual([A[1], A[0]]);
    expect(ride.routeLine?.coordinates.at(-1)).toEqual([D[1], D[0]]);
  });

  it('finds a ride for a rider joining part-way, far from where it starts', async () => {
    await Ride.create(rideDoc());
    // Near C, 9 km from the start at A: outside a 3 km radius of the start
    const { items, total } = await search([12.91, 77.59], [12.99, 77.61]);
    expect(total).toBe(1);
    expect(items[0].matchScore).toBeGreaterThan(0);
    expect(items[0]).not.toHaveProperty('routeLine');
  });

  it('leaves out a ride going the other way', async () => {
    await Ride.create(rideDoc());
    const { total } = await search([12.99, 77.61], [12.91, 77.52]);
    expect(total).toBe(0);
  });

  it('leaves out a ride whose route does not pass near the drop', async () => {
    await Ride.create(rideDoc());
    const { total } = await search([12.91, 77.52], [13.2, 77.9]);
    expect(total).toBe(0);
  });

  it('follows the road, not a straight line between the ends', async () => {
    await Ride.create(rideDoc());
    // On the straight A–D diagonal but about 5 km from the L-shaped road
    const { total } = await search([12.95, 77.55], [12.99, 77.6]);
    expect(total).toBe(0);
  });

  it('finds rides saved before routes were indexed once they are backfilled', async () => {
    await Ride.collection.insertOne(rideDoc()); // raw insert: no save hook, so no routeLine
    expect((await search([12.91, 77.59], [12.99, 77.61])).total).toBe(0);

    expect(await backfillRouteLines()).toBe(1);
    expect((await search([12.91, 77.59], [12.99, 77.61])).total).toBe(1);
  });

  it('does not show a rider their own ride', async () => {
    await Ride.create(rideDoc({ driver: riderId }));
    const { total } = await search([12.91, 77.59], [12.99, 77.61]);
    expect(total).toBe(0);
  });
});

describe('ride alerts (UC-R02 6a)', () => {
  const alerts = new RideAlertService();
  const stop = (p: [number, number], address: string) => ({ lat: p[0], lng: p[1], address });

  beforeEach(async () => {
    mockPush.mockClear();
    await RideAlert.deleteMany({});
    await RideAlert.init();
  });

  it('tells a waiting rider once when a ride on their route is posted', async () => {
    await alerts.create(riderId.toString(), { pickup: stop([12.91, 77.59], 'Near C, Bengaluru'), dropoff: stop([12.99, 77.61], 'Near D, Bengaluru'), departureTime: departure.toISOString() });
    const ride = await Ride.create(rideDoc());

    expect(await alerts.notifyMatches(ride)).toBe(1);
    expect(mockPush).toHaveBeenCalledWith(riderId.toString(), inEnglish('A ride on your route'), inEnglish('Near C to Near D', { contains: true }), expect.anything());
    expect(await alerts.notifyMatches(ride)).toBe(0); // never twice for the same ride
  });

  it('ignores rides going the other way, or at a very different time', async () => {
    await alerts.create(riderId.toString(), { pickup: stop([12.99, 77.61], 'D'), dropoff: stop([12.91, 77.59], 'C') });
    await alerts.create(riderId.toString(), {
      pickup: stop([12.91, 77.59], 'C'), dropoff: stop([12.99, 77.61], 'D'),
      departureTime: new Date(departure.getTime() + 6 * 3_600_000).toISOString(),
    });
    expect(await alerts.notifyMatches(await Ride.create(rideDoc()))).toBe(0);
  });
});

