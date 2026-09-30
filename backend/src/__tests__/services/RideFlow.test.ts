/**
 * The ride from the driver's side, against a real MongoDB: per-rider pickup
 * and drop, no-shows, editing a published ride, in-ride safety check-ins,
 * trip-share links and receipts.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
jest.mock('../../services/MapsService', () => ({ getRoute: jest.fn() }));
jest.mock('../../services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    createNotification: jest.fn().mockResolvedValue(undefined),
    sendPushNotification: jest.fn().mockResolvedValue(undefined),
  })),
}));
const mockEmit = jest.fn();
jest.mock('../../sockets/SocketGateway', () => ({
  SocketGateway: { getInstance: () => ({ getIO: () => ({ to: () => ({ emit: mockEmit }) }) }) },
}));
const mockTriggerSOS = jest.fn();
jest.mock('../../services/SafetyService', () => ({
  SafetyService: jest.fn().mockImplementation(() => ({ triggerSOS: mockTriggerSOS })),
}));

import { Ride } from '../../models/Ride';
import { Booking } from '../../models/Booking';
import { User } from '../../models/User';
import { TripShare } from '../../models/TripShare';
import { BookingService } from '../../services/BookingService';
import { RideService } from '../../services/RideService';
import { RideCheckInService } from '../../services/RideCheckInService';
import { TripShareService } from '../../services/TripShareService';
import { ReceiptService } from '../../services/ReceiptService';
import { EventBridge } from '../../events';
import { BookingStatus, RideStatus } from '../../types';

jest.setTimeout(60_000);

const MIN = 60_000;
const HOUR = 60 * MIN;
let mongo: MongoMemoryServer;
const bookings = new BookingService();
const rides = new RideService();
const riderId = new Types.ObjectId();
const driverId = new Types.ObjectId();
const vehicleId = new Types.ObjectId();

async function makeRide(status: RideStatus, departureInMs: number) {
  const departure = new Date(Date.now() + departureInMs);
  return Ride.create({
    driver: driverId, status,
    vehicle: { vehicleId, vehicleType: 'sedan', hasAC: true, plateNumber: 'KA05MN1234' },
    pickup: { location: { type: 'Point', coordinates: [77.60, 12.97] }, address: 'Indiranagar' },
    dropoff: { location: { type: 'Point', coordinates: [77.70, 12.96] }, address: 'Marathahalli' },
    departureTime: departure, estimatedArrivalTime: new Date(departure.getTime() + HOUR),
    estimatedDurationMins: 60, estimatedDistanceKm: 12, routePolyline: '',
    pricePerSeat: 200, availableSeats: 2, totalSeats: 3,
  });
}

async function makeBooking(rideId: Types.ObjectId, extra: Record<string, unknown> = {}) {
  return Booking.create({
    ride: rideId, rider: riderId, driver: driverId, status: BookingStatus.CONFIRMED, seatsBooked: 1, estimatedFare: 200,
    pickup: { location: { type: 'Point', coordinates: [77.61, 12.97] }, address: 'Indiranagar metro' },
    dropoff: { location: { type: 'Point', coordinates: [77.69, 12.96] }, address: 'Marathahalli bridge' },
    ...extra,
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
  jest.clearAllMocks();
  await mongoose.connection.db!.dropDatabase();
  await User.collection.insertMany([
    { _id: riderId, name: 'Asha Menon', phone: '+919000000001', email: 'asha@example.com', capabilities: ['rider'], stats: {} },
    { _id: driverId, name: 'Ravi Gowda', phone: '+919000000002', capabilities: ['rider', 'driver'], stats: { totalEarnings: 0 },
      vehicles: [{ _id: vehicleId, make: 'Maruti', model: 'Dzire', color: 'White', year: 2021, plateNumber: 'KA05MN1234', vehicleType: 'sedan' }] },
  ]);
});

describe('per-rider pickup and drop (UC-D04)', () => {
  it('goes arrived, picked up, dropped off, and settles the booking', async () => {
    const ride = await makeRide(RideStatus.IN_PROGRESS, -10 * MIN);
    const b = await makeBooking(ride._id);

    await bookings.markArrived(b.id, driverId.toString());
    await expect(bookings.markDroppedOff(b.id, driverId.toString())).rejects.toThrow('picked up first');
    await bookings.markPickedUp(b.id, driverId.toString());
    const done = await bookings.markDroppedOff(b.id, driverId.toString());

    expect(done.status).toBe(BookingStatus.COMPLETED);
    const saved = await Booking.findById(b._id).lean();
    expect(saved?.driverArrivedAt).toBeDefined();
    expect(saved?.actualPickupTime).toBeDefined();
    expect(saved?.actualDropoffTime).toBeDefined();
    expect(EventBridge.publish).toHaveBeenCalledWith('booking-events', expect.objectContaining({ eventType: 'booking.driver_arrived' }));
  });

  it('needs the ride to have started, and only the driver can do it', async () => {
    const ride = await makeRide(RideStatus.SCHEDULED, 3 * HOUR);
    const b = await makeBooking(ride._id);
    await expect(bookings.markArrived(b.id, driverId.toString())).rejects.toThrow('Start the ride first');
    await expect(bookings.markArrived(b.id, riderId.toString())).rejects.toThrow('driver');
  });
});

describe('no-shows (UC-D07)', () => {
  it('waits 10 minutes, then cancels with the fare paid to the driver', async () => {
    const ride = await makeRide(RideStatus.IN_PROGRESS, -20 * MIN);
    const b = await makeBooking(ride._id);
    await expect(bookings.reportNoShow(b.id, driverId.toString())).rejects.toThrow('arrived first');

    await bookings.markArrived(b.id, driverId.toString());
    await expect(bookings.reportNoShow(b.id, driverId.toString())).rejects.toThrow('more minute');

    await Booking.updateOne({ _id: b._id }, { $set: { driverArrivedAt: new Date(Date.now() - 11 * MIN) } });
    const cancelled = await bookings.reportNoShow(b.id, driverId.toString());
    expect(cancelled).toMatchObject({ status: BookingStatus.CANCELLED, noShow: true, refundAmount: 0, cancellationFee: 200, driverEarnings: 170 });
    expect((await User.findById(driverId).lean())?.stats.totalEarnings).toBe(170);
    expect((await Ride.findById(ride._id).lean())?.availableSeats).toBe(3);
  });
});

describe('editing a published ride (UC-D08)', () => {
  it('moves the departure within 2 hours and lets booked riders cancel for a full refund', async () => {
    const ride = await makeRide(RideStatus.SCHEDULED, 10 * HOUR);
    const b = await makeBooking(ride._id);
    await expect(rides.updateRide(ride.id, driverId.toString(), { departureTime: new Date(ride.departureTime.getTime() + 3 * HOUR).toISOString() })).rejects.toThrow('at most 2 hours');

    await rides.updateRide(ride.id, driverId.toString(), { departureTime: new Date(ride.departureTime.getTime() + HOUR).toISOString() });
    expect((await Booking.findById(b._id).lean())?.rideChangedAt).toBeDefined();

    // Within 24 hours a rider would normally get only 50%; after the change it is 100%
    const quote = await bookings.getCancellationQuote(b.id, riderId.toString());
    expect(quote.refundPercent).toBe(100);
  });

  it('adds seats but never removes them, and locks the price once someone has booked', async () => {
    const ride = await makeRide(RideStatus.SCHEDULED, 10 * HOUR);
    await expect(rides.updateRide(ride.id, driverId.toString(), { totalSeats: 2 })).rejects.toThrow('only be added');
    const more = await rides.updateRide(ride.id, driverId.toString(), { totalSeats: 4 });
    expect(more).toMatchObject({ totalSeats: 4, availableSeats: 3 });

    await expect(rides.updateRide(ride.id, driverId.toString(), { pricePerSeat: 300 })).rejects.toThrow('at most 20%');
    expect((await rides.updateRide(ride.id, driverId.toString(), { pricePerSeat: 230 })).pricePerSeat).toBe(230);

    await makeBooking(ride._id);
    await expect(rides.updateRide(ride.id, driverId.toString(), { pricePerSeat: 220 })).rejects.toThrow('fixed');
  });

  it('refuses changes within 4 hours of departure', async () => {
    const ride = await makeRide(RideStatus.SCHEDULED, 3 * HOUR);
    await expect(rides.updateRide(ride.id, driverId.toString(), { totalSeats: 4 })).rejects.toThrow('4 hours');
  });
});

describe('in-ride safety check-ins (UC-R05)', () => {
  it('asks every 30 minutes, repeats once, then raises an SOS', async () => {
    mockTriggerSOS.mockResolvedValue({ _id: 'sos1', timeline: [], save: jest.fn() });
    const service = new RideCheckInService();
    const ride = await makeRide(RideStatus.IN_PROGRESS, -40 * MIN);
    const b = await makeBooking(ride._id, { actualPickupTime: new Date(Date.now() - 31 * MIN) });

    expect(await service.runDue()).toEqual({ prompted: 1, escalated: 0 });
    expect(await service.runDue()).toEqual({ prompted: 0, escalated: 0 }); // still inside the 10-minute grace
    expect(mockEmit).toHaveBeenCalledWith('safety:check-in', { bookingId: b.id, repeat: false });

    const in11 = new Date(Date.now() + 11 * MIN);
    expect(await service.runDue(in11)).toEqual({ prompted: 1, escalated: 0 }); // repeated
    expect(await service.runDue(new Date(in11.getTime() + 11 * MIN))).toEqual({ prompted: 0, escalated: 1 });
    expect(mockTriggerSOS).toHaveBeenCalledWith(riderId.toString(), expect.objectContaining({ bookingId: b.id }));
  });

  it('an answer of OK resets the clock; "help" raises an SOS at once', async () => {
    mockTriggerSOS.mockResolvedValue({ _id: 'sos2', timeline: [], save: jest.fn() });
    const service = new RideCheckInService();
    const ride = await makeRide(RideStatus.IN_PROGRESS, -40 * MIN);
    const b = await makeBooking(ride._id, { actualPickupTime: new Date(Date.now() - 31 * MIN) });
    await service.runDue();

    await service.respond(riderId.toString(), b.id, 'ok');
    expect(await service.runDue(new Date(Date.now() + 20 * MIN))).toEqual({ prompted: 0, escalated: 0 });
    expect(mockTriggerSOS).not.toHaveBeenCalled();

    const result = await service.respond(riderId.toString(), b.id, 'help', { lng: 77.65, lat: 12.96 });
    expect(result).toMatchObject({ status: 'help', emergencyId: 'sos2' });
    expect(mockTriggerSOS).toHaveBeenCalledWith(riderId.toString(), { bookingId: b.id, location: { lng: 77.65, lat: 12.96 } });
  });
});

describe('trip-share links (UC-R08)', () => {
  it('shows the trip without an account, logs visits, and dies an hour after the drop', async () => {
    const ride = await makeRide(RideStatus.IN_PROGRESS, -10 * MIN);
    const b = await makeBooking(ride._id, { actualPickupTime: new Date() });
    const service = new TripShareService();
    await expect(service.create(driverId.toString(), b.id)).rejects.toThrow('Only the rider');

    const { url } = await service.create(riderId.toString(), b.id);
    const token = url.split('/').pop()!;
    const view = await service.publicView(token, '203.0.113.9');
    expect(view).toMatchObject({ riderFirstName: 'Asha', driverFirstName: 'Ravi', status: 'in_car', vehicle: 'White Maruti Dzire · KA05MN1234' });
    expect((await TripShare.findOne({ token }).lean())?.views).toHaveLength(1);

    await Booking.updateOne({ _id: b._id }, { $set: { status: BookingStatus.COMPLETED, actualDropoffTime: new Date(Date.now() - 2 * HOUR) } });
    expect(await service.publicView(token)).toBeNull();
    expect(await service.publicView('not-a-real-token')).toBeNull();
  });
});

describe('receipts (UC-R04)', () => {
  it('shows what was paid, refunded and how', async () => {
    const ride = await makeRide(RideStatus.COMPLETED, -3 * HOUR);
    const b = await makeBooking(ride._id, { status: BookingStatus.CANCELLED, refundAmount: 100, cancelledAt: new Date() });
    const service = new ReceiptService();
    const r = await service.build(b.id, riderId.toString());
    expect(r).toMatchObject({ status: 'cancelled', fare: 200, refunded: 100, paid: 100, paymentMethod: 'Poolora wallet' });
    expect(service.text(r)).toContain('Refunded US$100');
    await expect(service.build(b.id, new Types.ObjectId().toString())).rejects.toThrow('someone else');
  });
});
