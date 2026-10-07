/**
 * Company-paid fares (UC-C01), against a real MongoDB. A company pays its
 * share of eligible trips: on weekdays if it says so, to or from its sites,
 * up to a monthly cap. The rider is charged, refunded and cancelled on
 * their own part only, and on completion the company's part carries the
 * lower company commission.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
const mockGeocode = jest.fn();
jest.mock('../../services/MapsService', () => ({ getRoute: jest.fn(), geocodeAddress: (a: string) => mockGeocode(a) }));
jest.mock('../../services/ReceiptService', () => ({
  ...jest.requireActual('../../services/ReceiptService'),
  ReceiptService: jest.fn().mockImplementation(() => {
    const real = new (jest.requireActual('../../services/ReceiptService').ReceiptService)();
    return { build: real.build.bind(real), text: real.text.bind(real), html: real.html.bind(real) };
  }),
}));
jest.mock('../../services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendPushNotification: jest.fn().mockResolvedValue(undefined),
    createNotification: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { config } from '../../config';
import { fromLocalClock, toLocalClock, demandTime } from '../../config/region';
import { Organisation } from '../../models/Organisation';
import { Ride } from '../../models/Ride';
import { User } from '../../models/User';
import { Booking } from '../../models/Booking';
import { Wallet } from '../../models/Wallet';
import { BookingService } from '../../services/BookingService';
import { OrganisationService, companyContribution } from '../../services/OrganisationService';
import { ReceiptService } from '../../services/ReceiptService';
import { encodePolyline } from '../../utils/routeGeometry';
import { BookingStatus, RideStatus } from '../../types';

jest.setTimeout(60_000);

// Home in Avondale, the office in Borrowdale
const HOME = { lat: -17.8, lng: 31.04 };
const OFFICE = { lat: -17.75, lng: 31.09 };
const ELSEWHERE = { lat: -17.9, lng: 30.95 };

/** The next local weekday (0 = Monday) at 07:00 that is not a public holiday, at least a day away */
function next(weekday: number): Date {
  const local = toLocalClock(new Date(Date.now() + 86_400_000));
  for (let i = 0; i < 21; i++) {
    const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + i, 7));
    const when = fromLocalClock(d);
    const t = demandTime(when);
    if (t.weekday === weekday && !t.isHoliday) return when;
  }
  throw new Error('no such day');
}

let mongo: MongoMemoryServer;
const bookings = new BookingService();
const orgs = new OrganisationService();
const driverId = new Types.ObjectId();
const riderId = new Types.ObjectId();
const vehicleId = new Types.ObjectId();
const adminId = new Types.ObjectId();
let econet: Types.ObjectId;

async function ride(departure: Date, pricePerSeat = 10, from = HOME, to = OFFICE) {
  return Ride.create({
    driver: driverId,
    status: RideStatus.SCHEDULED,
    vehicle: { vehicleId, vehicleType: 'sedan', hasAC: true, plateNumber: 'AEA 1234' },
    pickup: { location: { type: 'Point', coordinates: [from.lng, from.lat] }, address: 'From' },
    dropoff: { location: { type: 'Point', coordinates: [to.lng, to.lat] }, address: 'To' },
    routePolyline: encodePolyline([from, to]),
    departureTime: departure,
    estimatedArrivalTime: new Date(departure.getTime() + 1800_000),
    estimatedDurationMins: 30,
    estimatedDistanceKm: 9,
    pricePerSeat,
    availableSeats: 3,
    totalSeats: 3,
  });
}

const book = (r: { _id: Types.ObjectId }, useWallet = true, from = HOME, to = OFFICE) =>
  bookings.createBooking(riderId.toString(), {
    rideId: r._id.toString(), seatsBooked: 1, useWallet,
    pickup: { ...from, address: 'From' }, dropoff: { ...to, address: 'To' },
  } as never);

const setPolicy = (policy: Record<string, unknown>) =>
  orgs.update(econet.toString(), { policy } as never, adminId.toString());

const officeSite = { name: 'Head office', address: 'Borrowdale', radiusKm: 1, lat: OFFICE.lat, lng: OFFICE.lng };

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([Organisation.init(), Booking.init(), User.init()]);
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  mockGeocode.mockReset();
  await Promise.all([Ride.deleteMany({}), User.deleteMany({}), Organisation.deleteMany({}), Booking.deleteMany({}), Wallet.deleteMany({})]);
  econet = (await Organisation.create({
    name: 'Econet', domains: ['econet.co.zw'], billingContact: { name: 'Accounts', email: 'accounts@econet.co.zw' }, createdBy: adminId,
  }))._id;
  await User.collection.insertMany([
    {
      _id: driverId, name: 'Nyasha Chuma', phone: '+263771000003', capabilities: ['rider', 'driver'], kyc: { status: 'approved' }, stats: {},
      vehicles: [{ _id: vehicleId, make: 'Toyota', model: 'Corolla', color: 'White', year: 2016, plateNumber: 'AEA 1234', vehicleType: 'sedan', registrationDocUrl: 'x', insuranceDocUrl: 'y' }],
    },
    { _id: riderId, name: 'Rudo Moyo', phone: '+263771000001', capabilities: ['rider'], stats: {}, work: { organisation: econet, email: 'rudo@econet.co.zw', verifiedAt: new Date() } },
  ]);
  await Wallet.create({ userId: riderId, balance: 100 });
  await Wallet.create({ userId: driverId, balance: 0 });
  await setPolicy({ sharePercent: 50, monthlyCapUsd: 0, weekdaysOnly: true, sites: [officeSite] });
});

const contribution = (departure: Date, fare = 10, from = HOME, to = OFFICE) =>
  companyContribution({ riderId: riderId.toString(), fare, departure, pickup: from, dropoff: to });

describe('when the company pays', () => {
  it('pays its share of a weekday trip to one of its sites', async () => {
    expect(await contribution(next(2))).toMatchObject({ company: 'Econet', share: 5 });
  });

  it('pays nothing at weekends when it pays on weekdays only, or anywhere away from its sites', async () => {
    expect(await contribution(next(5))).toBeNull();
    expect(await contribution(next(2), 10, HOME, ELSEWHERE)).toBeNull();
    await setPolicy({ weekdaysOnly: false });
    expect(await contribution(next(5))).toMatchObject({ share: 5 });
  });

  it('pays nothing without a share or a site, or while the company is suspended', async () => {
    await setPolicy({ sites: [] });
    expect(await contribution(next(2))).toBeNull();
    await setPolicy({ sharePercent: 0, sites: [officeSite] });
    expect(await contribution(next(2))).toBeNull();
    await setPolicy({ sharePercent: 50 });
    await orgs.update(econet.toString(), { status: 'suspended' }, adminId.toString());
    expect(await contribution(next(2))).toBeNull();
  });

  it('stops at the monthly cap, counting open requests but not cancelled ones', async () => {
    await setPolicy({ monthlyCapUsd: 8 });
    const day = next(2);
    const first = await book(await ride(day));
    expect(first.booking.companyShare).toBe(5);
    // 3 of the cap is left: the company pays 3, and says why it is less
    expect(await contribution(day)).toMatchObject({ share: 3, limitedBy: 'cap' });
    await Booking.updateOne({ _id: first.booking._id }, { $set: { status: BookingStatus.CANCELLED } });
    expect(await contribution(day)).toMatchObject({ share: 5 });
  });

  it('never goes over the cap when two bookings are made at once', async () => {
    await setPolicy({ monthlyCapUsd: 6 });
    const day = next(2);
    const [a, b] = [await ride(day), await ride(day)];
    const results = await Promise.allSettled([book(a), book(b)]);
    const made = results.filter((r) => r.status === 'fulfilled');
    // Either the second waits its turn and is refused, or it comes after and gets what is left
    for (const r of results) if (r.status === 'rejected') expect(r.reason).toMatchObject({ statusCode: 409 });
    const shares = await Booking.find({ rider: riderId }).lean();
    expect(shares.reduce((sum, x) => sum + (x.companyShare ?? 0), 0)).toBeLessThanOrEqual(6);
    expect(made.length).toBeGreaterThanOrEqual(1);
    // The hold is let go either way
    expect(await book(await ride(day))).toBeTruthy();
  });
});

describe('what the rider pays', () => {
  it('charges the wallet only the rider\'s part, and quotes it first', async () => {
    const r = await ride(next(2));
    const quote = await bookings.quote(riderId.toString(), { rideId: r.id, seatsBooked: 1, pickup: HOME, dropoff: OFFICE });
    expect(quote).toEqual({ fare: 10, companyShare: 5, youPay: 5, company: 'Econet' });
    const { booking } = await book(r);
    expect(booking).toMatchObject({ estimatedFare: 10, companyShare: 5 });
    expect((await Wallet.findOne({ userId: riderId }))!.balance).toBe(95);
  });

  it('charges nothing when the company pays it all, even when the rider chose to pay online', async () => {
    await setPolicy({ sharePercent: 100 });
    const { booking, paidViaWallet } = await book(await ride(next(2)), false);
    expect(paidViaWallet).toBe(true);
    expect(booking.paymentMethod).toBe('wallet');
    expect((await Wallet.findOne({ userId: riderId }))!.balance).toBe(100);
  });

  it('never charges more than the rider was shown when the company\'s part shrank meanwhile', async () => {
    const r = await ride(next(2));
    const quote = await bookings.quote(riderId.toString(), { rideId: r.id, seatsBooked: 1, pickup: HOME, dropoff: OFFICE });
    await setPolicy({ sharePercent: 0 });
    await expect(bookings.createBooking(riderId.toString(), {
      rideId: r.id, seatsBooked: 1, useWallet: true, expectedYouPay: quote.youPay,
      pickup: { ...HOME, address: 'From' }, dropoff: { ...OFFICE, address: 'To' },
    })).rejects.toMatchObject({ errorId: 'PRICE_CHANGED' });
    expect(await Booking.countDocuments({ rider: riderId })).toBe(0);
    expect((await Wallet.findOne({ userId: riderId }))!.balance).toBe(100);
  });

  it('refunds only what the rider paid when they cancel', async () => {
    const { booking } = await book(await ride(next(2)));
    await bookings.cancelBooking(booking.id, riderId.toString(), 'Plans changed');
    expect((await Booking.findById(booking._id))!.refundAmount).toBe(5);
    expect((await Wallet.findOne({ userId: riderId }))!.balance).toBe(100);
  });
});

describe('completing a company-paid trip', () => {
  it('takes the company commission on the company\'s part and the usual one on the rider\'s', async () => {
    const r = await ride(next(2));
    const { booking } = await book(r);
    await Booking.updateOne({ _id: booking._id }, { $set: { status: BookingStatus.CONFIRMED, actualPickupTime: new Date() } });
    await Ride.updateOne({ _id: r._id }, { $set: { status: RideStatus.IN_PROGRESS } });

    const done = await bookings.completeBooking(booking.id, driverId.toString());
    const fee = Math.round((5 * config.ride.platformFeeRate + 5 * config.ride.companyFeeRate) * 100) / 100;
    expect(done.platformFee).toBe(fee);
    expect(done.driverEarnings).toBe(Math.round((10 - fee) * 100) / 100);
    expect((await User.findById(riderId).lean())!.stats.totalSpent).toBe(5);

    const receipts = new ReceiptService();
    const receipt = await receipts.build(booking.id, riderId.toString());
    expect(receipt).toMatchObject({ fare: 10, paid: 5, companyPaid: 5, company: 'Econet' });
    expect(receipts.text(receipt)).toContain('Paid by Econet: US$5');
  });
});

describe('setting the policy', () => {
  it('checks the share and cap, and finds a new site on the map', async () => {
    await expect(setPolicy({ sharePercent: 120 })).rejects.toMatchObject({ statusCode: 422 });
    await expect(setPolicy({ monthlyCapUsd: -1 })).rejects.toMatchObject({ statusCode: 422 });
    mockGeocode.mockResolvedValueOnce({ lat: -17.83, lng: 31.05, formattedAddress: 'Samora Machel Ave, Harare', placeId: 'x' });
    const { organisation } = await setPolicy({ sites: [{ name: 'Town office', address: 'Samora Machel Ave', radiusKm: 0.5 }] });
    expect(organisation.policy.sites).toEqual([{ name: 'Town office', address: 'Samora Machel Ave', radiusKm: 0.5, lat: -17.83, lng: 31.05 }]);
    mockGeocode.mockRejectedValueOnce(new Error('not found'));
    await expect(setPolicy({ sites: [{ name: 'Nowhere', address: 'Zzzz', radiusKm: 1 }] })).rejects.toMatchObject({ errorId: 'SITE_NOT_FOUND' });
  });

  it('shows members what their company pays and how much of the cap is used', async () => {
    await setPolicy({ monthlyCapUsd: 40 });
    // A trip this month, so it counts against this month's cap
    const soon = new Date(Date.now() + 3 * 3600_000);
    await Booking.create({
      ride: new Types.ObjectId(), rider: riderId, driver: driverId, status: BookingStatus.COMPLETED, seatsBooked: 1,
      pickup: { location: { type: 'Point', coordinates: [HOME.lng, HOME.lat] }, address: 'A' },
      dropoff: { location: { type: 'Point', coordinates: [OFFICE.lng, OFFICE.lat] }, address: 'B' },
      estimatedFare: 10, companyShare: 5, organisation: econet, companyMonth: toLocalClock(soon).toISOString().slice(0, 7),
    });
    const { work } = await orgs.status(riderId.toString());
    expect(work?.contribution).toEqual({ sharePercent: 50, monthlyCapUsd: 40, weekdaysOnly: true, sites: ['Head office'], usedThisMonth: 5 });
  });
});
