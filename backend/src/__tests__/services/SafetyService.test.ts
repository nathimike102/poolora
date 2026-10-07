/**
 * SOS incidents (UC-R07, UC-A03) against a real MongoDB. The alert channels
 * (push, SMS) are mocked; everything else runs: the cancel window, the
 * one-open-SOS rule, paging until someone takes it, the phone going quiet,
 * and who may read what.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
const mockPage = jest.fn().mockResolvedValue({ push: 1, sms: 1 });
const mockText = jest.fn(async (phones: string[], _message: string) => phones);
const mockTellUser = jest.fn().mockResolvedValue(undefined);
jest.mock('../../services/SafetyAlerts', () => ({
  pageSafetyTeam: (...args: unknown[]) => mockPage(...args),
  textPeople: (phones: string[], message: string) => mockText(phones, message),
  pushToPhones: jest.fn().mockResolvedValue(undefined),
  smsAvailable: () => true,
  tellUser: (...args: unknown[]) => mockTellUser(...args),
}));
const mockRedisGet = jest.fn().mockResolvedValue(null);
jest.mock('../../config/redis', () => ({ getRedisClient: () => ({ get: mockRedisGet }) }));

import { Ride } from '../../models/Ride';
import { Booking } from '../../models/Booking';
import { User } from '../../models/User';
import { EmergencyRecord } from '../../models/EmergencyRecord';
import { EmergencyToken } from '../../models/EmergencyToken';
import { SafetyService } from '../../services/SafetyService';
import { EventBridge } from '../../events';
import { config } from '../../config';
import { BookingStatus, RideStatus, SOSCheckInStatus, SOSRiskLevel, SOSStatus } from '../../types';
import { inEnglish } from '../setup/english';

jest.setTimeout(60_000);

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
let mongo: MongoMemoryServer;
const service = new SafetyService();
const riderId = new Types.ObjectId();
const driverId = new Types.ObjectId();
const adminId = new Types.ObjectId();
const strangerId = new Types.ObjectId();
const vehicleId = new Types.ObjectId();
const rider = riderId.toString();
const driver = driverId.toString();
const HERE = { lng: 31.05, lat: -17.83 };

async function makeRide(status: RideStatus, departureInMs: number) {
  const departure = new Date(Date.now() + departureInMs);
  return Ride.create({
    driver: driverId, status,
    vehicle: { vehicleId, vehicleType: 'sedan', hasAC: true, plateNumber: 'AEA 1234' },
    pickup: { location: { type: 'Point', coordinates: [31.05, -17.83] }, address: 'Avondale' },
    dropoff: { location: { type: 'Point', coordinates: [31.10, -17.80] }, address: 'Borrowdale' },
    departureTime: departure, estimatedArrivalTime: new Date(departure.getTime() + HOUR),
    estimatedDurationMins: 30, estimatedDistanceKm: 9, routePolyline: '',
    pricePerSeat: 2, availableSeats: 2, totalSeats: 3,
  });
}

async function makeBooking(rideId: Types.ObjectId, extra: Record<string, unknown> = {}) {
  return Booking.create({
    ride: rideId, rider: riderId, driver: driverId, status: BookingStatus.CONFIRMED, seatsBooked: 1, estimatedFare: 2,
    pickup: { location: { type: 'Point', coordinates: [31.051, -17.831] }, address: 'Avondale shops' },
    dropoff: { location: { type: 'Point', coordinates: [31.101, -17.801] }, address: 'Sam Levy Village' },
    ...extra,
  });
}

async function activeBooking() {
  const ride = await makeRide(RideStatus.IN_PROGRESS, -10 * MIN);
  return makeBooking(ride._id, { actualPickupTime: new Date() });
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
  mockRedisGet.mockResolvedValue(null);
  await mongoose.connection.db!.dropDatabase();
  await EmergencyRecord.createIndexes();
  await User.collection.insertMany([
    {
      _id: riderId, name: 'Rudo Moyo', phone: '+263771000001', capabilities: ['rider'], stats: {},
      emergencyContacts: [
        { _id: new Types.ObjectId(), name: 'Mai Rudo', phone: '+263772000001', relation: 'mother', primary: true, notifyOnSos: true },
        { _id: new Types.ObjectId(), name: 'Tino', phone: '+263772000002', relation: 'brother', notifyOnSos: false },
      ],
    },
    {
      _id: driverId, name: 'Tafadzwa Ncube', phone: '+263771000002', capabilities: ['rider', 'driver'], stats: {},
      vehicles: [{ _id: vehicleId, make: 'Toyota', model: 'Corolla', color: 'White', year: 2016, plateNumber: 'AEA 1234', vehicleType: 'sedan' }],
    },
    { _id: adminId, name: 'Chipo Admin', phone: '+263771000003', capabilities: ['rider', 'admin'], stats: {} },
    { _id: strangerId, name: 'Someone Else', phone: '+263771000004', capabilities: ['rider'], stats: {} },
  ]);
});

describe('raising an SOS', () => {
  it('pages the safety team at once, but waits out the cancel window before texting contacts', async () => {
    const b = await activeBooking();
    const sos = await service.triggerSOS(rider, { bookingId: b.id, location: HERE });

    expect(sos.status).toBe(SOSStatus.TRIGGERED);
    expect(sos.locationSource).toBe('device');
    expect(mockPage).toHaveBeenCalledWith(sos.id, 'Rudo Moyo (rider) raised an SOS');
    expect(EventBridge.publish).toHaveBeenCalledWith('safety-events', expect.objectContaining({ eventType: 'sos.triggered' }));
    expect(sos.contactsState).toBe('pending');
    expect(sos.contactsDueAt!.getTime() - sos.createdAt.getTime()).toBeCloseTo(config.safety.contactDelaySeconds * SEC, -2);
    expect(mockText).not.toHaveBeenCalled();
    expect(await EmergencyToken.countDocuments({ emergencyId: sos._id })).toBe(1);
  });

  it('is never blocked by a missing GPS fix: it uses the car\'s last position, then the pickup', async () => {
    const b = await activeBooking();
    mockRedisGet.mockResolvedValueOnce(JSON.stringify({ lng: 31.07, lat: -17.82 }));
    const fromCar = await service.triggerSOS(rider, { bookingId: b.id });
    expect(fromCar.locationSource).toBe('ride');
    expect(fromCar.triggerLocation.coordinates).toEqual([31.07, -17.82]);

    const b2 = await activeBooking();
    const fromPickup = await service.triggerSOS(rider, { bookingId: b2.id });
    expect(fromPickup.locationSource).toBe('pickup');
    expect(fromPickup.triggerLocation.coordinates).toEqual([31.051, -17.831]);
    expect(fromPickup.timeline.map((t) => t.event)).toContain('Position from the ride');
  });

  it('refuses people outside the booking and bookings that are not confirmed', async () => {
    const b = await activeBooking();
    await expect(service.triggerSOS(strangerId.toString(), { bookingId: b.id, location: HERE })).rejects.toThrow('not part of this booking');
    const pending = await makeBooking((await makeRide(RideStatus.SCHEDULED, HOUR))._id, { status: BookingStatus.PENDING });
    await expect(service.triggerSOS(rider, { bookingId: pending.id, location: HERE })).rejects.toThrow('confirmed ride');
  });

  it('a second press returns the open SOS, raised again, instead of failing or duplicating it', async () => {
    const b = await activeBooking();
    const first = await service.triggerSOS(rider, { bookingId: b.id, location: HERE });
    const again = await service.triggerSOS(rider, { bookingId: b.id, location: HERE });

    expect(again.id).toBe(first.id);
    expect(again.riskLevel).toBe(SOSRiskLevel.HIGH);
    expect(await EmergencyRecord.countDocuments()).toBe(1);
    expect(mockPage).toHaveBeenLastCalledWith(first.id, 'Rudo Moyo raised their SOS again');
  });

  it('two presses at the same moment still make one SOS', async () => {
    const b = await activeBooking();
    const [a, c] = await Promise.all([
      service.triggerSOS(rider, { bookingId: b.id, location: HERE }),
      service.triggerSOS(rider, { bookingId: b.id, location: HERE }),
    ]);
    expect(a.id).toBe(c.id);
    expect(await EmergencyRecord.countDocuments()).toBe(1);
  });

  it('the rider and the driver can each raise their own SOS on the same ride', async () => {
    const b = await activeBooking();
    await service.triggerSOS(rider, { bookingId: b.id, location: HERE });
    const byDriver = await service.triggerSOS(driver, { bookingId: b.id, location: HERE });
    expect(byDriver.contactsState).toBe('none'); // the driver has no contacts saved
    expect(await EmergencyRecord.countDocuments({ status: SOSStatus.TRIGGERED })).toBe(2);
  });

  it('an SOS raised for missed check-ins gives the rider longer before contacts are texted', async () => {
    const b = await activeBooking();
    const sos = await service.triggerSOS(rider, { bookingId: b.id, location: HERE, auto: true, reason: 'Missed two check-ins' });
    expect(sos.contactsDueAt!.getTime() - sos.createdAt.getTime()).toBeCloseTo(config.safety.autoContactDelaySeconds * SEC, -2);
    expect(mockPage).toHaveBeenCalledWith(sos.id, 'Rudo Moyo (rider) did not answer two safety check-ins');
  });
});

describe('emergency contacts and the cancel window (UC-R07 3a)', () => {
  it('texts only the contacts chosen for SOS, once, after the window', async () => {
    const b = await activeBooking();
    const sos = await service.triggerSOS(rider, { bookingId: b.id, location: HERE });

    expect(await service.sendContactAlerts(sos.id)).toBe(false); // window still open
    const later = new Date(Date.now() + 11 * SEC);
    expect(await service.sendContactAlerts(sos.id, later)).toBe(true);
    expect(await service.sendContactAlerts(sos.id, later)).toBe(false); // never twice

    expect(mockText).toHaveBeenCalledTimes(1);
    const [phones, message] = mockText.mock.calls[0];
    expect(phones).toEqual(['+263772000001']);
    expect(message).toContain('Rudo raised an emergency alert');
    expect(message).toContain(sos.liveTrackingUrl);
    expect(message).toContain('999');

    const saved = await EmergencyRecord.findById(sos.id).lean();
    expect(saved?.contactsState).toBe('sent');
    expect(saved?.emergencyContactsNotified.map((c) => c.name)).toEqual(['Mai Rudo']);
  });

  it('cancelling inside the window closes it as a false alarm and nobody outside is texted', async () => {
    const b = await activeBooking();
    const sos = await service.triggerSOS(rider, { bookingId: b.id, location: HERE });
    const cancelled = await service.cancelSOS(sos.id, rider);

    expect(cancelled.status).toBe(SOSStatus.FALSE_ALARM);
    expect(cancelled.contactsState).toBe('cancelled');
    expect(cancelled.openKey).toBeUndefined();
    expect(cancelled.retentionExpiresAt).toBeDefined();
    expect(await service.sendContactAlerts(sos.id, new Date(Date.now() + MIN))).toBe(false);
    expect(mockText).not.toHaveBeenCalled();
    expect(mockPage).toHaveBeenLastCalledWith(sos.id, expect.stringContaining('cancelled their SOS'));

    // A real emergency after that raises a new one
    const next = await service.triggerSOS(rider, { bookingId: b.id, location: HERE });
    expect(next.id).not.toBe(sos.id);
  });

  it('"I\'m safe" inside the window is the same as cancelling', async () => {
    const b = await activeBooking();
    const sos = await service.triggerSOS(rider, { bookingId: b.id, location: HERE });
    const answered = await service.updateSOSCheckIn(sos.id, rider, { status: SOSCheckInStatus.OK });
    expect(answered.status).toBe(SOSStatus.FALSE_ALARM);
  });

  it('cannot be cancelled once contacts have been texted, and only by the person who raised it', async () => {
    const b = await activeBooking();
    const sos = await service.triggerSOS(rider, { bookingId: b.id, location: HERE });
    await expect(service.cancelSOS(sos.id, driver)).rejects.toThrow('do not have access');
    await service.sendContactAlerts(sos.id, new Date(Date.now() + 11 * SEC));
    await expect(service.cancelSOS(sos.id, rider)).rejects.toThrow('already been told');
  });
});

describe('"I\'m safe" and danger reports during an SOS', () => {
  async function sentSos() {
    const b = await activeBooking();
    const sos = await service.triggerSOS(rider, { bookingId: b.id, location: HERE });
    await service.sendContactAlerts(sos.id, new Date(Date.now() + 11 * SEC));
    await EmergencyRecord.updateOne({ _id: sos._id }, { $set: { contactsDueAt: new Date(Date.now() - MIN), createdAt: new Date(Date.now() - MIN) } });
    jest.clearAllMocks();
    return sos;
  }

  it('after the window, "I\'m safe" is passed on but the incident stays open for the team', async () => {
    const sos = await sentSos();
    const answered = await service.updateSOSCheckIn(sos.id, rider, { status: SOSCheckInStatus.OK });

    expect(answered.status).toBe(SOSStatus.TRIGGERED);
    expect(answered.userSafeAt).toBeDefined();
    expect(answered.nextCheckInAt).toBeUndefined();
    expect(mockText).toHaveBeenCalledWith(['+263772000001'], expect.stringContaining('says they are safe'));
    expect(mockPage).toHaveBeenCalledWith(sos.id, expect.stringContaining('says they are safe'), { sms: false });
  });

  it('reporting danger raises the risk without pretending an admin took it', async () => {
    const sos = await sentSos();
    const answered = await service.updateSOSCheckIn(sos.id, rider, { status: SOSCheckInStatus.NOT_OK });
    expect(answered.status).toBe(SOSStatus.TRIGGERED);
    expect(answered.riskLevel).toBe(SOSRiskLevel.HIGH);
    expect(mockPage).toHaveBeenCalledWith(sos.id, 'Rudo Moyo reports they are in danger', { sms: true });
  });

  it('raising it again after "I\'m safe" tells the contacts it is live again', async () => {
    const sos = await sentSos();
    await service.updateSOSCheckIn(sos.id, rider, { status: SOSCheckInStatus.OK });
    jest.clearAllMocks();
    await service.triggerSOS(rider, { bookingId: String(sos.booking), location: HERE });
    expect(mockText).toHaveBeenCalledWith(['+263772000001'], expect.stringContaining('raised their emergency alert again'));
  });

  it('only the person who raised it speaks for it', async () => {
    const sos = await sentSos();
    await expect(service.updateSOSCheckIn(sos.id, driver, { status: SOSCheckInStatus.OK })).rejects.toThrow('do not have access');
    await expect(service.updateSOSCheckIn(sos.id, adminId.toString(), { status: SOSCheckInStatus.OK })).rejects.toThrow('do not have access');
  });
});

describe('the safety team (UC-A03)', () => {
  it('one admin takes it; the user is told; the risk level is left alone', async () => {
    const b = await activeBooking();
    const sos = await service.triggerSOS(rider, { bookingId: b.id, location: HERE });
    const taken = await service.acknowledgeSOS(sos.id, adminId.toString());

    expect(taken.status).toBe(SOSStatus.ACKNOWLEDGED);
    expect(taken.riskLevel).toBe(SOSRiskLevel.LOW);
    expect(taken.timeline.at(-1)).toMatchObject({ event: 'Taken by the safety team', details: 'Chipo Admin' });
    expect(mockTellUser).toHaveBeenCalledWith(rider, expect.objectContaining({ change: 'acknowledged', body: inEnglish('Chipo from the Siham safety team is on it and will call you.') }));
    await expect(service.acknowledgeSOS(sos.id, adminId.toString())).rejects.toThrow('already acknowledged');
  });

  it('closing keeps a real incident, keeps a false alarm for 90 days, and tells the contacts', async () => {
    const b = await activeBooking();
    const sos = await service.triggerSOS(rider, { bookingId: b.id, location: HERE });
    await service.sendContactAlerts(sos.id, new Date(Date.now() + 11 * SEC));
    const closed = await service.resolveSOS(sos.id, adminId.toString(), 'Called her; she is home', false);

    expect(closed.status).toBe(SOSStatus.RESOLVED);
    expect(closed.retentionExpiresAt).toBeUndefined();
    expect(closed.openKey).toBeUndefined();
    expect(mockText).toHaveBeenLastCalledWith(['+263772000001'], expect.stringContaining('has been closed'));
    await expect(service.resolveSOS(sos.id, adminId.toString(), 'again', false)).rejects.toThrow('already closed');

    const second = await service.triggerSOS(rider, { bookingId: b.id, location: HERE });
    const falseAlarm = await service.resolveSOS(second.id, adminId.toString(), 'Pressed in a pocket', true);
    const days = (falseAlarm.retentionExpiresAt!.getTime() - Date.now()) / 86_400_000;
    expect(Math.round(days)).toBe(config.safety.falseAlarmRetentionDays);
  });

  it('the other person on the ride cannot read the SOS; admins can', async () => {
    const b = await activeBooking();
    const sos = await service.triggerSOS(rider, { bookingId: b.id, location: HERE });
    await expect(service.getSOSStatus(sos.id, driver)).rejects.toThrow('do not have access');
    await expect(service.getSOSStatus(sos.id, adminId.toString())).resolves.toBeDefined();
    await expect(service.getSOSStatus(sos.id, rider)).resolves.toBeDefined();
  });
});

describe('the SOS monitor', () => {
  it('texts contacts whose window passed, even if the in-process timer was lost', async () => {
    const b = await activeBooking();
    const sos = await service.triggerSOS(rider, { bookingId: b.id, location: HERE });
    const done = await service.monitor(new Date(Date.now() + 11 * SEC));
    expect(done.contacts).toBe(1);
    expect((await EmergencyRecord.findById(sos.id))?.contactsState).toBe('sent');
  });

  it('pages the team when the phone goes quiet, once, and clears when it is heard again', async () => {
    const b = await activeBooking();
    const sos = await service.triggerSOS(rider, { bookingId: b.id, location: HERE });
    jest.clearAllMocks();
    const low = config.safety.checkInSeconds.low * SEC;

    expect((await service.monitor(new Date(Date.now() + low + SEC))).lostContact).toBe(0);
    const later = new Date(Date.now() + 3 * low + SEC);
    expect((await service.monitor(later)).lostContact).toBe(1);
    expect((await service.monitor(new Date(later.getTime() + low))).lostContact).toBe(0);

    let saved = await EmergencyRecord.findById(sos.id).lean();
    expect(saved?.riskLevel).toBe(SOSRiskLevel.HIGH);
    expect(saved?.lostContactAt).toBeDefined();
    expect(mockPage).toHaveBeenCalledWith(sos.id, expect.stringContaining('Lost contact'));

    await service.updateSOSLocation(sos.id, rider, HERE);
    saved = await EmergencyRecord.findById(sos.id).lean();
    expect(saved?.lostContactAt).toBeUndefined();
    expect(saved?.timeline.at(-1)?.event).toBe('Phone back in contact');
  });

  it('does not count a phone as lost after the person said they are safe', async () => {
    const b = await activeBooking();
    const sos = await service.triggerSOS(rider, { bookingId: b.id, location: HERE });
    await service.sendContactAlerts(sos.id, new Date(Date.now() + 11 * SEC));
    await EmergencyRecord.updateOne({ _id: sos._id }, { $set: { contactsDueAt: new Date(Date.now() - MIN) } });
    await service.updateSOSCheckIn(sos.id, rider, { status: SOSCheckInStatus.OK });
    expect((await service.monitor(new Date(Date.now() + HOUR))).lostContact).toBe(0);
  });

  it('pages every admin again while nobody has taken it, and stops once someone does', async () => {
    const b = await activeBooking();
    const sos = await service.triggerSOS(rider, { bookingId: b.id, location: HERE });
    jest.clearAllMocks();
    const target = config.safety.ackTargetMins * MIN;

    expect((await service.monitor(new Date(Date.now() + target - SEC))).repaged).toBe(0);
    const t1 = new Date(Date.now() + target + SEC);
    expect((await service.monitor(t1)).repaged).toBe(1);
    expect((await service.monitor(t1)).repaged).toBe(0); // not twice in the same interval
    expect(mockPage).toHaveBeenCalledWith(sos.id, expect.stringContaining("Nobody has taken Rudo Moyo's SOS"));

    await service.acknowledgeSOS(sos.id, adminId.toString());
    expect((await service.monitor(new Date(t1.getTime() + 2 * target))).repaged).toBe(0);
  });
});

describe('positions during an SOS', () => {
  it('only the person who raised it can send them, and they are kept', async () => {
    const b = await activeBooking();
    const sos = await service.triggerSOS(rider, { bookingId: b.id, location: HERE });
    await expect(service.updateSOSLocation(sos.id, driver, HERE)).rejects.toThrow('do not have access');
    await service.updateSOSLocation(sos.id, rider, { lng: 31.06, lat: -17.82 });
    const saved = await EmergencyRecord.findById(sos.id).lean();
    expect(saved?.locationHistory).toHaveLength(2);
    expect(EventBridge.publish).toHaveBeenCalledWith('safety-events', expect.objectContaining({ eventType: 'sos.location.updated' }));
  });
});

describe('evidence', () => {
  it('takes recordings only into this incident\'s own folder, and only from the person who raised it', async () => {
    const b = await activeBooking();
    const sos = await service.triggerSOS(rider, { bookingId: b.id, location: HERE });
    const other = await service.triggerSOS(driver, { bookingId: b.id, location: HERE });
    const { sosEvidencePrefix } = await import('../../services/UploadService');

    await expect(service.audioUploadFor(sos.id, driver, 'audio/mp4')).rejects.toThrow('do not have access');
    await expect(service.addEvidence(sos.id, rider, 'audio', `${sosEvidencePrefix(other.id)}a.m4a`)).rejects.toThrow('Upload the recording again');
    await expect(service.addEvidence(sos.id, rider, 'audio', 'http://example.com/a.m4a')).rejects.toThrow('https');
    await service.addEvidence(sos.id, rider, 'audio', `${sosEvidencePrefix(sos.id)}part1.m4a`);
    expect((await EmergencyRecord.findById(sos.id).lean())?.audioRecordingUrls).toEqual([`${sosEvidencePrefix(sos.id)}part1.m4a`]);
  });

  it('tells the phone when the SOS is closed, so its background tracking stops', async () => {
    const b = await activeBooking();
    const sos = await service.triggerSOS(rider, { bookingId: b.id, location: HERE });
    expect(await service.updateSOSLocation(sos.id, rider, HERE)).toBe(true);
    await service.resolveSOS(sos.id, adminId.toString(), 'Called her; she is home', false);
    expect(await service.updateSOSLocation(sos.id, rider, HERE)).toBe(false);
  });
});

describe('which ride an SOS is about', () => {
  it('prefers the ride under way over another confirmed booking, and never picks tomorrow', async () => {
    const tomorrow = await makeBooking((await makeRide(RideStatus.SCHEDULED, 24 * HOUR))._id);
    expect(await service.currentBookingId(rider)).toBeNull();

    const soon = await makeBooking((await makeRide(RideStatus.SCHEDULED, 30 * MIN))._id);
    expect(await service.currentBookingId(rider)).toBe(soon.id);

    const now = await activeBooking();
    expect(await service.currentBookingId(rider)).toBe(now.id);
    expect(await service.currentBookingId(driver)).toBe(now.id);
    expect(tomorrow.id).not.toBe(now.id);
  });

  it('returns the open SOS when the screen opens again', async () => {
    const b = await activeBooking();
    const sos = await service.triggerSOS(rider, { bookingId: b.id, location: HERE });
    const current = await service.getCurrent(rider);
    expect(current.sos?.id).toBe(sos.id);
    expect(current.bookingId).toBe(b.id);
  });
});

describe('the tracking page for emergency contacts', () => {
  it('shows what the police would need, and no phone numbers', async () => {
    const b = await activeBooking();
    const sos = await service.triggerSOS(rider, { bookingId: b.id, location: HERE });
    const token = (await EmergencyToken.findOne({ emergencyId: sos._id }))!.token;
    const view = await service.getPublicTracking(token);

    expect(view).toMatchObject({
      firstName: 'Rudo',
      status: SOSStatus.TRIGGERED,
      lastLocation: HERE,
      trip: { from: 'Avondale shops', to: 'Sam Levy Village', vehicle: 'White Toyota Corolla, plate AEA 1234', otherRole: 'driver', otherFirstName: 'Tafadzwa' },
    });
    expect(JSON.stringify(view)).not.toContain('+263');
  });
});
