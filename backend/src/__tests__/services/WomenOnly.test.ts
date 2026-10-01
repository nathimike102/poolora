/**
 * Women-only rides (PRD "Safe for her"), against a real MongoDB. Only a woman
 * whose identity check an admin approved can post, find or book one; a
 * declared gender is not enough, and a ride id does not get round search.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
jest.mock('../../services/MapsService', () => ({ getRoute: jest.fn() }));
const mockDeleteFiles = jest.fn().mockResolvedValue(2);
jest.mock('../../services/UploadService', () => ({
  ...jest.requireActual('../../services/UploadService'),
  deleteKycFiles: (urls: string[]) => mockDeleteFiles(urls),
}));
jest.mock('../../services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendPushNotification: jest.fn().mockResolvedValue(undefined),
    createNotification: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { Ride } from '../../models/Ride';
import { User } from '../../models/User';
import { RideAlert } from '../../models/RideAlert';
import { RideService } from '../../services/RideService';
import { BookingService } from '../../services/BookingService';
import { IdentityService } from '../../services/IdentityService';
import { kycPrefix } from '../../services/UploadService';
import { RideStatus } from '../../types';

jest.setTimeout(60_000);

/** Google polyline encoding */
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

const FROM: [number, number] = [-17.83, 31.05];
const TO: [number, number] = [-17.78, 31.10];
const departure = new Date(Date.now() + 3 * 3600_000);

let mongo: MongoMemoryServer;
const rides = new RideService();
const bookings = new BookingService();
const identity = new IdentityService();
const womanId = new Types.ObjectId();
const manId = new Types.ObjectId();
const driverId = new Types.ObjectId();
const adminId = new Types.ObjectId();
const vehicleId = new Types.ObjectId();

async function womenOnlyRide() {
  return Ride.create({
    driver: driverId,
    status: RideStatus.SCHEDULED,
    vehicle: { vehicleId, vehicleType: 'sedan', hasAC: true, plateNumber: 'AEA 1234' },
    pickup: { location: { type: 'Point', coordinates: [FROM[1], FROM[0]] }, address: 'Avondale' },
    dropoff: { location: { type: 'Point', coordinates: [TO[1], TO[0]] }, address: 'Borrowdale' },
    routePolyline: encode([FROM, TO]),
    departureTime: departure,
    estimatedArrivalTime: new Date(departure.getTime() + 3600_000),
    estimatedDurationMins: 30,
    estimatedDistanceKm: 9,
    pricePerSeat: 2,
    availableSeats: 3,
    totalSeats: 3,
    preferences: { womenOnly: true },
  });
}

function search(userId: Types.ObjectId, womenOnly?: boolean) {
  return rides.searchRides(
    userId.toString(),
    { pickupLat: FROM[0], pickupLng: FROM[1], dropoffLat: TO[0], dropoffLng: TO[1], departureTime: departure, radiusKm: 3, womenOnly },
    1,
    20,
  );
}

async function sendCheck(userId: Types.ObjectId, gender: 'female' | 'male') {
  const prefix = kycPrefix(userId.toString());
  return identity.submit(userId.toString(), { documentUrl: `${prefix}identity/a.jpg`, selfieUrl: `${prefix}selfie/b.jpg`, gender });
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Ride.init();
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  await Promise.all([Ride.deleteMany({}), User.deleteMany({}), RideAlert.deleteMany({}), mongoose.connection.collection('bookings').deleteMany({})]);
  await User.collection.insertMany([
    { _id: womanId, name: 'Rudo Moyo', phone: '+263771000001', capabilities: ['rider'], kyc: { status: 'none' }, stats: {} },
    { _id: manId, name: 'Farai Dube', phone: '+263771000002', capabilities: ['rider'], kyc: { status: 'none' }, stats: {} },
    {
      _id: driverId, name: 'Nyasha Chuma', phone: '+263771000003', capabilities: ['rider', 'driver'], kyc: { status: 'approved' }, stats: {},
      vehicles: [{ _id: vehicleId, make: 'Toyota', model: 'Corolla', color: 'White', year: 2016, plateNumber: 'AEA 1234', vehicleType: 'sedan', registrationDocUrl: 'x', insuranceDocUrl: 'y' }],
    },
    { _id: adminId, name: 'Admin', phone: '+263771000004', capabilities: ['rider', 'admin'], stats: {} },
  ]);
});

describe('who sees and books women-only rides', () => {
  it('a woman who has only declared her gender does not see them, and is told to verify', async () => {
    await womenOnlyRide();
    await identity.setDeclaredGender(womanId.toString(), 'female');
    expect((await search(womanId)).total).toBe(0);
    await expect(search(womanId, true)).rejects.toMatchObject({ statusCode: 403, errorId: 'IDENTITY_NOT_VERIFIED' });

    await sendCheck(womanId, 'female');
    await expect(search(womanId, true)).rejects.toMatchObject({ errorId: 'IDENTITY_PENDING' });
  });

  it('a verified woman sees and books them', async () => {
    const ride = await womenOnlyRide();
    await sendCheck(womanId, 'female');
    await identity.approve(womanId.toString(), adminId.toString(), 'female');

    expect((await search(womanId)).total).toBe(1);
    expect((await search(womanId, true)).total).toBe(1);
    const booking = await bookings.createBooking(womanId.toString(), {
      rideId: ride.id, seatsBooked: 1,
      pickup: { lng: FROM[1], lat: FROM[0], address: 'Avondale' },
      dropoff: { lng: TO[1], lat: TO[0], address: 'Borrowdale' },
    } as never);
    expect(booking).toBeDefined();
  });

  it('a man neither sees one nor books it by its id', async () => {
    const ride = await womenOnlyRide();
    expect((await search(manId)).total).toBe(0);
    await expect(bookings.createBooking(manId.toString(), {
      rideId: ride.id, seatsBooked: 1,
      pickup: { lng: FROM[1], lat: FROM[0], address: 'Avondale' },
      dropoff: { lng: TO[1], lat: TO[0], address: 'Borrowdale' },
    } as never)).rejects.toMatchObject({ statusCode: 403, errorId: 'WOMEN_ONLY' });
  });

  it('a man who declares himself a woman is still refused until an admin checks his ID', async () => {
    const ride = await womenOnlyRide();
    await identity.setDeclaredGender(manId.toString(), 'female');
    await sendCheck(manId, 'female');
    await expect(bookings.createBooking(manId.toString(), {
      rideId: ride.id, seatsBooked: 1,
      pickup: { lng: FROM[1], lat: FROM[0], address: 'Avondale' },
      dropoff: { lng: TO[1], lat: TO[0], address: 'Borrowdale' },
    } as never)).rejects.toMatchObject({ errorId: 'IDENTITY_PENDING' });

    // The admin confirms the gender the person lives as, not what was typed
    await identity.approve(manId.toString(), adminId.toString(), 'male');
    expect((await search(manId)).total).toBe(0);
  });
});

describe('ride alerts', () => {
  it('tell a verified woman about a new women-only ride on her route, and nobody else', async () => {
    const { RideAlertService } = await import('../../services/RideAlertService');
    const alerts = new RideAlertService();
    await RideAlert.init();
    const stop = (p: [number, number], address: string) => ({ lat: p[0], lng: p[1], address });
    await alerts.create(womanId.toString(), { pickup: stop(FROM, 'Avondale'), dropoff: stop(TO, 'Borrowdale') });
    await alerts.create(manId.toString(), { pickup: stop(FROM, 'Avondale'), dropoff: stop(TO, 'Borrowdale') });
    await sendCheck(womanId, 'female');
    await identity.approve(womanId.toString(), adminId.toString(), 'female');

    expect(await alerts.notifyMatches(await womenOnlyRide())).toBe(1);
    expect(await RideAlert.countDocuments({ rider: womanId, notifiedRides: { $size: 1 } })).toBe(1);
    expect(await RideAlert.countDocuments({ rider: manId, notifiedRides: { $size: 1 } })).toBe(0);
  });
});

describe('posting women-only rides', () => {
  const post = (womenOnly: boolean) => rides.createRide(driverId.toString(), {
    rideType: 'carpool', vehicleId: vehicleId.toString(),
    pickup: { lng: FROM[1], lat: FROM[0], address: 'Avondale' },
    dropoff: { lng: TO[1], lat: TO[0], address: 'Borrowdale' },
    departureTime: departure.toISOString(), totalSeats: 3, pricePerSeat: 2, recurring: 'none',
    preferences: { womenOnly } as never,
  });

  it('only a verified woman driver can post one', async () => {
    await expect(post(true)).rejects.toMatchObject({ statusCode: 403, errorId: 'IDENTITY_NOT_VERIFIED' });
    await identity.setDeclaredGender(driverId.toString(), 'female');
    await expect(post(true)).rejects.toMatchObject({ errorId: 'IDENTITY_NOT_VERIFIED' });
  });
});

describe('identity checks', () => {
  it('accepts only files from the user\'s own upload folder', async () => {
    const other = kycPrefix(manId.toString());
    await expect(identity.submit(womanId.toString(), { documentUrl: `${other}identity/a.jpg`, selfieUrl: `${other}selfie/b.jpg`, gender: 'female' }))
      .rejects.toMatchObject({ errorId: 'INVALID_DOCUMENT' });
  });

  it('a rejection needs a reason and can be sent again; approval locks the gender', async () => {
    await sendCheck(womanId, 'female');
    await expect(identity.reject(womanId.toString(), adminId.toString(), 'no')).rejects.toThrow('Say what');
    const rejected = await identity.reject(womanId.toString(), adminId.toString(), 'The selfie is too dark to compare');
    expect(rejected).toMatchObject({ status: 'rejected', rejectionReason: 'The selfie is too dark to compare' });

    await sendCheck(womanId, 'female');
    expect((await identity.queue()).map((c) => String(c._id))).toEqual([womanId.toString()]);
    await identity.approve(womanId.toString(), adminId.toString(), 'female');
    await expect(identity.approve(womanId.toString(), adminId.toString(), 'female')).rejects.toThrow('not waiting');

    // Only the decision is kept: the ID photo and selfie are gone
    await identity.deletePhotos(womanId.toString()); // finishes the background deletion for the test
    expect(mockDeleteFiles).toHaveBeenCalledWith([expect.stringContaining('identity/a.jpg'), expect.stringContaining('selfie/b.jpg')]);
    const kept = await User.findById(womanId).lean();
    expect(kept?.identity).toMatchObject({ status: 'verified', declaredGender: 'female' });
    expect(kept?.identity?.documentUrl).toBeUndefined();
    expect(kept?.identity?.selfieUrl).toBeUndefined();
    expect(kept?.identity?.photosDeletedAt).toBeDefined();

    await expect(identity.setDeclaredGender(womanId.toString(), 'male')).rejects.toMatchObject({ errorId: 'IDENTITY_VERIFIED' });
    await expect(sendCheck(womanId, 'male')).rejects.toMatchObject({ errorId: 'IDENTITY_VERIFIED' });
    await expect(identity.setDeclaredGender(womanId.toString(), 'female')).resolves.toBeUndefined();
  });
});
