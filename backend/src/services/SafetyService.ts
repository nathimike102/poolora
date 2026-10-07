/**
 * SafetyService.ts
 *
 * SOS incidents (UC-R07, UC-A03). The order matters when someone is in danger:
 *
 * 1. The SOS is raised the moment the user finishes the 3-second hold, with
 *    the phone's position, or the car's last position when the phone has none.
 *    A missing GPS fix never stops an alert.
 * 2. The safety team is paged at once (push, SMS and the live dashboard), and
 *    paged again every few minutes until an admin takes the incident.
 * 3. Emergency contacts are texted after a short window (10 seconds by
 *    default) in which the user can cancel an accidental press. After that,
 *    only an admin closes the incident.
 * 4. While it is open the phone sends its position every few seconds. A phone
 *    that goes quiet is marked out of contact and the team is paged.
 *
 * "I'm safe" from the user is recorded and passed on to their contacts, but
 * the incident stays open until the safety team has confirmed it, so a
 * person made to tap it under pressure is still called.
 */

import { v4 as uuidv4 } from 'uuid';
import { Types } from 'mongoose';
import { EmergencyRecord, IEmergencyRecord, SOSLocationSource, SOSThreat } from '../models/EmergencyRecord';
import { EmergencyToken } from '../models/EmergencyToken';
import { Booking, IBooking } from '../models/Booking';
import { Ride } from '../models/Ride';
import { User } from '../models/User';
import { BookingStatus, RideStatus, SOSStatus, SOSRiskLevel, SOSMonitoringState, SOSCheckInStatus, UserCapability } from '../types';
import { AppError, NotFoundError, AuthorizationError } from '../utils/AppError';
import { toGeoPoint } from '../utils/helpers';
import { EventBridge } from '../events';
import { logger } from '../utils/logger';
import { config } from '../config';
import { getRedisClient } from '../config/redis';
import { REGION } from '../config/region';
import { pageSafetyTeam, pushToPhones, smsAvailable, tellUser, textPeople } from './SafetyAlerts';
import { phrase, withEnglish } from '../i18n';
import { endSosVideo } from './SosVideoService';
import { recordingAvailable, videoAvailable } from './LiveVideo';

type Position = { lng: number; lat: number };

const OPEN = [SOSStatus.TRIGGERED, SOSStatus.ACKNOWLEDGED];
const DAY = 86_400_000;
/** About seven hours of positions at one every 5 seconds */
const MAX_TRAIL = 5000;
/** A cancel that arrives just after the window closes, on a slow network, still counts */
const CANCEL_GRACE_MS = 5_000;
/** Silent intervals before the phone counts as out of contact */
const MISSED_BEFORE_LOST = 3;
/** Rides this close to now count as the current one when none is under way */
const CURRENT_RIDE_WINDOW_MS = 3 * 3_600_000;

const isOpen = (record: { status: SOSStatus }) => OPEN.includes(record.status);

/**
 * What the battery says about a phone that went quiet: one near empty has
 * probably run out; one with charge left was switched off, taken, or lost
 * its signal, which is the more worrying case.
 */
export function batteryReading(battery?: number): string {
  if (battery === undefined) return 'Battery level unknown.';
  const pct = Math.round(battery * 100);
  return pct <= 5
    ? `Its battery was at ${pct}%: it has probably run out.`
    : `Its battery was at ${pct}%: it was switched off, taken, or lost signal.`;
}

const THREAT_WORDS: Record<SOSThreat, string> = {
  driver: 'the driver',
  passenger: 'a passenger',
  outside: 'someone outside the car',
  medical: 'a medical emergency',
  accident: 'an accident',
  other: 'something else',
};

function tooLateToCancel(contactsState: string): AppError {
  const what = contactsState === 'sent' || contactsState === 'sending'
    ? 'Your emergency contacts have already been told.'
    : 'The time to cancel has passed.';
  return new AppError(`${what} Tap "I'm safe" so the safety team can check on you and close it.`, 409, 'SOS_CANCEL_WINDOW_CLOSED');
}

/** Returns the id of a ref whether or not it has been populated. */
function refId(ref: unknown): string {
  const value = (ref as { _id?: unknown } | null)?._id ?? ref;
  return String(value);
}

const firstName = (name?: string) => (name ?? '').trim().split(/\s+/)[0] || 'Your contact';

function safetyConfig() {
  return config.safety as {
    checkInSeconds: { low: number; medium: number; high: number };
    contactDelaySeconds: number;
    autoContactDelaySeconds: number;
    ackTargetMins: number;
    falseAlarmRetentionDays: number;
    trackingTokenTtlSeconds: number;
  };
}

/** Seconds the phone may go without sending a position, by risk level (admin-editable). */
function intervalSeconds(riskLevel: SOSRiskLevel): number {
  const seconds = safetyConfig().checkInSeconds;
  if (riskLevel === SOSRiskLevel.HIGH) return seconds.high;
  if (riskLevel === SOSRiskLevel.MEDIUM) return seconds.medium;
  return seconds.low;
}

/**
 * Where the person is when their phone cannot say: the car's live position
 * for this booking (kept a minute by the tracking socket), else the car's
 * last stored trail point, else the booking's pickup point.
 */
export async function lastKnownPosition(booking: IBooking): Promise<{ position: Position; source: SOSLocationSource }> {
  const redis = getRedisClient();
  const cached = redis ? await redis.get(`booking:${booking._id}:driver:location`).catch(() => null) : null;
  if (cached) {
    try {
      const { lng, lat } = JSON.parse(cached) as Position;
      if (Number.isFinite(lng) && Number.isFinite(lat)) return { position: { lng, lat }, source: 'ride' };
    } catch {
      // Fall through to the pickup point
    }
  }
  const { lastCarPosition } = await import('./TripTrailService');
  const car = await lastCarPosition(booking.ride).catch(() => null);
  if (car) return { position: { lng: car.lng, lat: car.lat }, source: 'ride' };
  const [lng, lat] = booking.pickup.location.coordinates;
  return { position: { lng, lat }, source: 'pickup' };
}

export class SafetyService {
  private async isAdmin(userId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(userId)) return false;
    const user = await User.findById(userId).select('capabilities');
    return Boolean(user?.capabilities?.includes(UserCapability.ADMIN));
  }

  /** Only the user who raised the SOS may feed it or speak for it. */
  private assertTriggerer(record: Pick<IEmergencyRecord, 'triggeredBy'>, userId: string): void {
    if (refId(record.triggeredBy) !== userId) {
      throw new AuthorizationError('You do not have access to update this SOS record');
    }
  }

  // ─── Raising ───────────────────────────────────────────────────────────────

  /**
   * Raises an SOS for a confirmed booking the user is part of. Raising again
   * while one is open returns that one (re-armed), so a second press never
   * fails. `auto` marks one raised by missed in-ride check-ins.
   */
  async triggerSOS(
    userId: string,
    data: { bookingId: string; location?: Position; reason?: string; auto?: boolean; via?: 'tracker' },
  ): Promise<IEmergencyRecord> {
    const booking = await Booking.findById(data.bookingId);
    if (!booking) throw new NotFoundError('Booking');

    const isRider = booking.rider.toString() === userId;
    const isDriver = booking.driver.toString() === userId;
    if (!isRider && !isDriver) {
      throw new AuthorizationError('You are not part of this booking');
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new AppError('SOS alerts work during a confirmed ride. If you are in danger, call the emergency services.', 400, 'SOS_NOT_AVAILABLE');
    }

    const openKey = `${booking._id}:${userId}`;
    const existing = await EmergencyRecord.findOne({ openKey });
    if (existing) return this.raiseAgain(existing, data);

    const user = await User.findById(userId).select('name emergencyContacts');
    if (!user) throw new NotFoundError('User');

    let position = data.location;
    let source: SOSLocationSource = 'device';
    if (!position) ({ position, source } = await lastKnownPosition(booking));

    const settings = safetyConfig();
    const now = new Date();
    const emergencyId = new Types.ObjectId();
    const token = uuidv4();
    const liveTrackingUrl = `${config.app.baseUrl}/track/sos/${token}`;
    // Saved before anything is sent, so the link works the moment a text arrives
    await EmergencyToken.create({
      token,
      emergencyId,
      expiresAt: new Date(now.getTime() + settings.trackingTokenTtlSeconds * 1000),
    }).catch((err: Error) => logger.error('Failed to persist emergency token', { error: err.message }));

    const contacts = (user.emergencyContacts ?? []).filter((c) => c.notifyOnSos !== false);
    const delaySeconds = data.auto ? settings.autoContactDelaySeconds : settings.contactDelaySeconds;
    const role = isRider ? 'rider' : 'driver';
    const point = toGeoPoint(position.lng, position.lat);
    const timeline: IEmergencyRecord['timeline'] = [
      { event: data.via === 'tracker' ? 'Raised by the car\'s panic button' : 'SOS raised', timestamp: now, details: data.via === 'tracker' ? data.reason : [`By the ${role}`, data.reason].filter(Boolean).join('. ') },
    ];
    if (source !== 'device') {
      timeline.push({
        event: 'Position from the ride',
        timestamp: now,
        details: source === 'ride' ? "The phone had no position; using the car's last reported position" : 'The phone had no position; using the pickup point',
      });
    }
    timeline.push({ event: 'Safety team paged', timestamp: now });
    if (!contacts.length) timeline.push({ event: 'No emergency contacts to text', timestamp: now });

    let record: IEmergencyRecord;
    try {
      record = await EmergencyRecord.create({
        _id: emergencyId,
        booking: booking._id,
        ride: booking.ride,
        triggeredBy: userId,
        openKey,
        status: SOSStatus.TRIGGERED,
        triggerLocation: point,
        locationSource: source,
        locationHistory: [{ location: point, timestamp: now }],
        audioRecordingUrls: [],
        screenshotUrls: [],
        raisedVia: data.via ?? (data.auto ? 'check-in' : 'app'),
        riskLevel: data.auto ? SOSRiskLevel.MEDIUM : SOSRiskLevel.LOW,
        monitoringState: SOSMonitoringState.ACTIVE,
        checkInIntervalSeconds: intervalSeconds(SOSRiskLevel.LOW),
        lastCheckInAt: now,
        nextCheckInAt: new Date(now.getTime() + intervalSeconds(SOSRiskLevel.LOW) * 1000),
        missedCheckIns: 0,
        contactsState: contacts.length ? 'pending' : 'none',
        contactsDueAt: contacts.length ? new Date(now.getTime() + delaySeconds * 1000) : undefined,
        emergencyContactsNotified: [],
        adminNotifiedAt: now,
        lastPagedAt: now,
        pageCount: 1,
        liveTrackingUrl,
        timeline,
      });
    } catch (error) {
      // Two presses at once: the unique openKey let only one through
      if ((error as { code?: number }).code === 11000) {
        const winner = await EmergencyRecord.findOne({ openKey });
        if (winner) return winner;
      }
      throw error;
    }

    // Every phone's trail on this ride is kept with the incident
    const { keepTripTrail } = await import('./TripTrailService');
    void keepTripTrail(String(booking.ride));

    EventBridge.publish('safety-events', {
      eventType: 'sos.triggered',
      data: { emergencyId, bookingId: booking._id, triggeredBy: userId, location: position, liveTrackingUrl },
    });
    const headline = data.via === 'tracker'
      ? `${data.reason ?? 'The panic button in the car was pressed'} (driver ${user.name})`
      : data.auto
        ? `${user.name} (${role}) did not answer two safety check-ins`
        : `${user.name} (${role}) raised an SOS`;
    void pageSafetyTeam(String(emergencyId), headline);
    if (contacts.length) this.scheduleContactAlerts(String(emergencyId), delaySeconds);

    logger.warn('SOS TRIGGERED', { emergencyId, userId, bookingId: data.bookingId, auto: Boolean(data.auto) });
    return record;
  }

  /** A second press, or a new check-in escalation, on an SOS that is still open. */
  private async raiseAgain(
    record: IEmergencyRecord,
    data: { location?: Position; reason?: string; auto?: boolean },
  ): Promise<IEmergencyRecord> {
    const now = new Date();
    if (data.location) {
      record.locationHistory.push({ location: toGeoPoint(data.location.lng, data.location.lat), timestamp: now });
    }
    if (data.auto) {
      // The team is already on it; keep the note
      record.timeline.push({ event: 'Missed safety check-ins', timestamp: now, details: data.reason });
      await record.save();
      return record;
    }

    const saidSafe = Boolean(record.userSafeAt);
    record.userSafeAt = undefined;
    record.riskLevel = SOSRiskLevel.HIGH;
    record.monitoringState = SOSMonitoringState.ESCALATED;
    record.checkInIntervalSeconds = intervalSeconds(SOSRiskLevel.HIGH);
    record.lastCheckInAt = now;
    record.nextCheckInAt = new Date(now.getTime() + record.checkInIntervalSeconds * 1000);
    record.escalatedAt = now;
    record.escalationReason = 'The SOS was raised again';
    record.timeline.push({ event: 'SOS raised again', timestamp: now, details: saidSafe ? 'After saying they were safe' : undefined });
    await record.save();

    EventBridge.publish('safety-events', {
      eventType: 'sos.escalated',
      data: { emergencyId: record._id, reason: record.escalationReason },
    });
    const user = await User.findById(record.triggeredBy).select('name emergencyContacts language').lean();
    void pageSafetyTeam(String(record._id), `${user?.name ?? 'Someone'} raised their SOS again`);
    if (saidSafe && record.emergencyContactsNotified.length) {
      // They were told the person was safe; they must hear that it is live again
      void textPeople(
        record.emergencyContactsNotified.map((c) => c.phone),
        // In the person's language, with the English beneath for contacts who read only English
        withEnglish(user?.language, phrase('sos.contacts.raisedAgain', { name: firstName(user?.name), url: record.liveTrackingUrl, number: REGION.emergency.general })),
      );
    }
    return record;
  }

  // ─── Emergency contacts ────────────────────────────────────────────────────

  private scheduleContactAlerts(emergencyId: string, delaySeconds: number): void {
    // The SOS monitor also sweeps due alerts, so a restart in between loses nothing
    const timer = setTimeout(() => {
      this.sendContactAlerts(emergencyId).catch((error: Error) =>
        logger.error('Could not text emergency contacts', { emergencyId, error: error.message }));
    }, Math.max(0, delaySeconds * 1000) + 50);
    timer.unref?.();
  }

  /**
   * Texts the user's SOS contacts once the cancel window has passed. Claimed
   * atomically, so it happens once even with several backend instances, and
   * never after a cancel.
   */
  async sendContactAlerts(emergencyId: string, now = new Date()): Promise<boolean> {
    const record = await EmergencyRecord.findOneAndUpdate(
      { _id: emergencyId, contactsState: 'pending', contactsDueAt: { $lte: now }, status: { $in: OPEN } },
      { $set: { contactsState: 'sending' } },
      { new: true },
    );
    if (!record) return false;

    const user = await User.findById(record.triggeredBy).select('name emergencyContacts language').lean();
    const contacts = (user?.emergencyContacts ?? []).filter((c) => c.notifyOnSos !== false);
    const who = firstName(user?.name);
    // In the person's language, with the English beneath for contacts who read only English (UC-X03)
    const message = withEnglish(user?.language, phrase('sos.contacts.raised', {
      name: who, url: record.liveTrackingUrl, number: REGION.emergency.general, police: REGION.emergency.police,
    }));

    const reached = new Set(await textPeople(contacts.map((c) => c.phone), message));
    // Contacts with the app get a push in their own language
    void pushToPhones(contacts.map((c) => c.phone), phrase('sos.contacts.pushTitle', { name: who }), phrase('sos.contacts.pushBody'), { type: 'sos_contact', url: record.liveTrackingUrl });

    const sentAt = new Date();
    const notified = contacts
      .filter((c) => reached.has(c.phone))
      .map((c) => ({ name: c.name, phone: c.phone, notifiedAt: sentAt, method: 'sms' as const }));
    const available = smsAvailable();
    await EmergencyRecord.updateOne(
      { _id: record._id },
      {
        $set: { contactsState: available ? 'sent' : 'unavailable' },
        $push: {
          emergencyContactsNotified: { $each: notified },
          timeline: {
            event: available ? 'Emergency contacts texted' : 'Emergency contacts could not be texted',
            timestamp: sentAt,
            details: available ? `${notified.length} of ${contacts.length} reached` : 'Text messages are not set up (Twilio)',
          },
        },
      },
    );
    void tellUser(refId(record.triggeredBy), { emergencyId: String(record._id), change: 'contacts' });
    return true;
  }

  // ─── The user's side ───────────────────────────────────────────────────────

  /**
   * Cancels an accidental SOS inside the window, before emergency contacts
   * are texted (UC-R07 3a). It closes as a false alarm and the team is told.
   */
  async cancelSOS(emergencyId: string, userId: string): Promise<IEmergencyRecord> {
    const current = await EmergencyRecord.findById(emergencyId);
    if (!current) throw new NotFoundError('Emergency record');
    this.assertTriggerer(current, userId);
    if (!isOpen(current)) throw new AppError('This SOS is already closed', 409, 'SOS_CLOSED');

    const now = new Date();
    const windowEnds = (current.contactsDueAt ?? new Date(current.createdAt.getTime() + safetyConfig().contactDelaySeconds * 1000)).getTime();
    if (now.getTime() > windowEnds + CANCEL_GRACE_MS) {
      throw tooLateToCancel(current.contactsState);
    }

    const record = await EmergencyRecord.findOneAndUpdate(
      { _id: emergencyId, status: { $in: OPEN }, contactsState: { $nin: ['sending', 'sent'] } },
      {
        $set: {
          status: SOSStatus.FALSE_ALARM,
          monitoringState: SOSMonitoringState.RESOLVED,
          riskLevel: SOSRiskLevel.LOW,
          cancelledAt: now,
          resolvedAt: now,
          resolutionNotes: 'Cancelled by the user before their emergency contacts were told',
          contactsState: current.contactsState === 'pending' ? 'cancelled' : current.contactsState,
          retentionExpiresAt: new Date(now.getTime() + safetyConfig().falseAlarmRetentionDays * DAY),
        },
        $unset: { openKey: 1, nextCheckInAt: 1 },
        $push: { timeline: { event: 'Cancelled by the user', timestamp: now, details: 'Inside the cancel window; emergency contacts were not texted' } },
      },
      { new: true },
    );
    if (!record) {
      throw tooLateToCancel('sent'); // the atomic update lost to the texts going out
    }

    EventBridge.publish('safety-events', {
      eventType: 'sos.resolved',
      data: { emergencyId: record._id, resolvedBy: userId, isFalseAlarm: true, cancelled: true },
    });
    void endSosVideo(String(record._id));
    const user = await User.findById(userId).select('name').lean();
    void pageSafetyTeam(String(record._id), `${user?.name ?? 'The user'} cancelled their SOS within seconds (pressed by accident)`);
    return record;
  }

  /**
   * The user's answer about how they are during an SOS. "ok" inside the cancel
   * window cancels it; after that it is recorded and passed on, and the team
   * still confirms. "partial_ok" and "not_ok" raise the risk level.
   */
  async updateSOSCheckIn(
    emergencyId: string,
    userId: string,
    data: { status: SOSCheckInStatus; notes?: string; location?: Position },
  ): Promise<IEmergencyRecord> {
    const record = await EmergencyRecord.findById(emergencyId);
    if (!record) throw new NotFoundError('Emergency record');
    this.assertTriggerer(record, userId);
    if (!isOpen(record)) throw new AppError('SOS already closed', 400);

    const now = new Date();
    if (data.status === SOSCheckInStatus.OK && record.contactsState !== 'sent' && record.contactsState !== 'sending') {
      const windowEnds = (record.contactsDueAt ?? new Date(record.createdAt.getTime() + safetyConfig().contactDelaySeconds * 1000)).getTime();
      if (now.getTime() <= windowEnds + CANCEL_GRACE_MS) return this.cancelSOS(emergencyId, userId);
    }

    record.lastCheckInAt = now;
    record.missedCheckIns = 0;
    if (data.location) {
      record.locationHistory.push({ location: toGeoPoint(data.location.lng, data.location.lat), timestamp: now });
    }

    const user = await User.findById(record.triggeredBy).select('name language').lean();
    const name = user?.name ?? 'The user';

    if (data.status === SOSCheckInStatus.OK) {
      record.userSafeAt = now;
      record.riskLevel = SOSRiskLevel.LOW;
      record.monitoringState = SOSMonitoringState.ACTIVE;
      record.nextCheckInAt = undefined;
      record.lostContactAt = undefined;
      record.timeline.push({ event: 'Said they are safe', timestamp: now, details: data.notes });
      await record.save();

      EventBridge.publish('safety-events', { eventType: 'sos.updated', data: { emergencyId: record._id, change: 'user_safe' } });
      void pageSafetyTeam(String(record._id), `${name} says they are safe. Call to confirm, then close the SOS`, { sms: false });
      if (record.emergencyContactsNotified.length) {
        void textPeople(
          record.emergencyContactsNotified.map((c) => c.phone),
          withEnglish(user?.language, phrase('sos.contacts.safe', { name: firstName(user?.name) })),
        );
      }
      return record;
    }

    const notOk = data.status === SOSCheckInStatus.NOT_OK;
    record.userSafeAt = undefined;
    record.riskLevel = notOk ? SOSRiskLevel.HIGH : SOSRiskLevel.MEDIUM;
    record.monitoringState = SOSMonitoringState.ESCALATED;
    record.checkInIntervalSeconds = intervalSeconds(record.riskLevel);
    record.nextCheckInAt = new Date(now.getTime() + record.checkInIntervalSeconds * 1000);
    record.escalatedAt = now;
    record.escalationReason = data.notes || (notOk ? 'The user reported danger' : 'The user asked to keep being watched');
    record.timeline.push({
      event: notOk ? 'Reported danger' : 'Asked to keep being watched',
      timestamp: now,
      details: data.notes,
    });
    await record.save();

    EventBridge.publish('safety-events', {
      eventType: 'sos.escalated',
      data: { emergencyId: record._id, reason: record.escalationReason, checkInStatus: data.status },
    });
    void pageSafetyTeam(String(record._id), notOk ? `${name} reports they are in danger` : `${name} is not fully safe`, { sms: notOk });
    return record;
  }

  /**
   * The phone's position during an SOS, every few seconds. It is also the
   * sign that the phone is still with the person, so it resets the silence
   * timer. Written atomically: positions arrive faster than a load-and-save.
   * Returns whether the SOS is still open, so the phone's background tracking
   * stops itself once it is closed.
   */
  async updateSOSLocation(emergencyId: string, userId: string, location: Position, battery?: number): Promise<boolean> {
    const record = await EmergencyRecord.findById(emergencyId)
      .select('triggeredBy status riskLevel userSafeAt lostContactAt')
      .lean();
    if (!record) throw new NotFoundError('Emergency record');
    this.assertTriggerer(record, userId);
    if (!isOpen(record)) return false;

    const now = new Date();
    const hasBattery = typeof battery === 'number' && battery >= 0 && battery <= 1;
    const update: Record<string, Record<string, unknown>> = {
      $push: { locationHistory: { $each: [{ location: toGeoPoint(location.lng, location.lat), timestamp: now, ...(hasBattery ? { battery } : {}) }], $slice: -MAX_TRAIL } },
      $set: { lastCheckInAt: now, missedCheckIns: 0, ...(hasBattery ? { lastBattery: battery } : {}) },
    };
    if (!record.userSafeAt) {
      update.$set.nextCheckInAt = new Date(now.getTime() + intervalSeconds(record.riskLevel) * 1000);
    }
    if (record.lostContactAt) {
      update.$unset = { lostContactAt: 1 };
      update.$push.timeline = { event: 'Phone back in contact', timestamp: now };
    }
    await EmergencyRecord.updateOne({ _id: emergencyId }, update);

    // On the safety stream, which relays it to the admins' live map
    EventBridge.publish('safety-events', {
      eventType: 'sos.location.updated',
      data: { emergencyId, location, timestamp: now.toISOString() },
    });
    return true;
  }

  /**
   * "What's happening?" (optional, after the alert has gone). Naming a person
   * on the ride raises the risk; a medical emergency or an accident means the
   * other person may be able to help, which the team is told.
   */
  async setThreat(emergencyId: string, userId: string, threat: SOSThreat): Promise<IEmergencyRecord> {
    const record = await EmergencyRecord.findById(emergencyId);
    if (!record) throw new NotFoundError('Emergency record');
    this.assertTriggerer(record, userId);
    if (!isOpen(record)) throw new AppError('This SOS is already closed', 409, 'SOS_CLOSED');
    if (!THREAT_WORDS[threat]) throw new AppError('Choose what is happening', 422, 'VALIDATION_ERROR');

    const now = new Date();
    record.threat = threat;
    record.timeline.push({ event: 'Said what is happening', timestamp: now, details: THREAT_WORDS[threat] });
    const named = threat === 'driver' || threat === 'passenger';
    if (named) {
      record.riskLevel = SOSRiskLevel.HIGH;
      record.monitoringState = SOSMonitoringState.ESCALATED;
      record.checkInIntervalSeconds = intervalSeconds(SOSRiskLevel.HIGH);
    }
    await record.save();

    EventBridge.publish('safety-events', { eventType: 'sos.updated', data: { emergencyId: record._id, change: 'threat' } });
    const user = await User.findById(userId).select('name').lean();
    const help = threat === 'medical' || threat === 'accident' ? ' The other person on the ride may be able to help.' : '';
    void pageSafetyTeam(String(record._id), `${user?.name ?? 'The person'} says the danger is ${THREAT_WORDS[threat]}.${help}`, { sms: named });
    return record;
  }

  /**
   * A place to upload one chunk of SOS audio. Only the person who raised the
   * SOS; also just after it closes, so the last chunk is not lost.
   */
  async audioUploadFor(emergencyId: string, userId: string, contentType: string) {
    const record = await EmergencyRecord.findById(emergencyId).select('triggeredBy');
    if (!record) throw new NotFoundError('Emergency record');
    this.assertTriggerer(record, userId);
    const { presignSosAudioUpload } = await import('./UploadService');
    return presignSosAudioUpload(emergencyId, contentType);
  }

  /**
   * Evidence (audio or a screenshot) during an SOS. Stored recordings must be
   * this incident's own (sos/<id>/); other evidence must be an https link.
   */
  async addEvidence(emergencyId: string, userId: string, type: 'audio' | 'screenshot', url: string): Promise<void> {
    const record = await EmergencyRecord.findById(emergencyId);
    if (!record) throw new NotFoundError('Emergency record');
    this.assertTriggerer(record, userId);
    if (url.startsWith('s3://')) {
      const { sosEvidencePrefix } = await import('./UploadService');
      if (!url.startsWith(sosEvidencePrefix(emergencyId))) throw new AppError('Upload the recording again', 422, 'INVALID_DOCUMENT');
    } else if (!url.startsWith('https://')) {
      throw new AppError('Evidence must be an uploaded file or an https link', 422, 'VALIDATION_ERROR');
    }

    const evidenceField = type === 'audio' ? 'audioRecordingUrls' : 'screenshotUrls';
    record[evidenceField].push(url);
    record.timeline.push({ event: `${type} evidence uploaded`, timestamp: new Date() });
    await record.save();
  }

  /**
   * What the SOS screen needs when it opens: the user's open SOS, if any, so
   * leaving the screen never loses it, and otherwise the booking an SOS would
   * be about.
   */
  async getCurrent(userId: string): Promise<{ sos: IEmergencyRecord | null; bookingId: string | null; videoAvailable: boolean; videoRecorded: boolean }> {
    const sos = await EmergencyRecord.findOne({ triggeredBy: userId, status: { $in: OPEN } }).sort({ createdAt: -1 });
    const bookingId = sos ? refId(sos.booking) : await this.currentBookingId(userId);
    // Whether the SOS screen may offer the camera (UC-X04), and says it is recorded before it comes on
    return { sos, bookingId, videoAvailable: videoAvailable(), videoRecorded: recordingAvailable() };
  }

  /**
   * The booking an SOS is about: a ride under way first (for a rider, one
   * they are in or waiting for), else the confirmed ride leaving closest to
   * now within three hours either side. Never tomorrow's ride.
   */
  async currentBookingId(userId: string, now = new Date()): Promise<string | null> {
    const bookings = await Booking.find({
      $or: [{ rider: userId }, { driver: userId }],
      status: BookingStatus.CONFIRMED,
      actualDropoffTime: { $exists: false },
    }).select('ride rider driver actualPickupTime').limit(100).lean();
    if (!bookings.length) return null;

    const rides = await Ride.find({ _id: { $in: bookings.map((b) => b.ride) } }).select('status departureTime').lean();
    const rideOf = new Map(rides.map((r) => [String(r._id), r]));

    const underWay = bookings.filter((b) => rideOf.get(String(b.ride))?.status === RideStatus.IN_PROGRESS);
    if (underWay.length) {
      // For a driver with several riders, one already in the car
      const inCar = underWay.find((b) => b.actualPickupTime);
      return String((inCar ?? underWay[0])._id);
    }

    let best: { id: string; gap: number } | null = null;
    for (const b of bookings) {
      const ride = rideOf.get(String(b.ride));
      if (!ride || ride.status !== RideStatus.SCHEDULED) continue;
      const gap = Math.abs(new Date(ride.departureTime).getTime() - now.getTime());
      if (gap <= CURRENT_RIDE_WINDOW_MS && (!best || gap < best.gap)) best = { id: String(b._id), gap };
    }
    return best?.id ?? null;
  }

  // ─── The safety team's side ────────────────────────────────────────────────

  /** An admin takes the incident. Only one admin can; the user is told someone has it. */
  async acknowledgeSOS(emergencyId: string, adminId: string): Promise<IEmergencyRecord> {
    const admin = await User.findById(adminId).select('name').lean();
    const record = await EmergencyRecord.findOneAndUpdate(
      { _id: emergencyId, status: SOSStatus.TRIGGERED },
      {
        $set: { status: SOSStatus.ACKNOWLEDGED, adminAssignee: new Types.ObjectId(adminId) },
        $push: { timeline: { event: 'Taken by the safety team', timestamp: new Date(), details: admin?.name ?? `Admin ${adminId}` } },
      },
      { new: true },
    );
    if (!record) {
      const exists = await EmergencyRecord.exists({ _id: emergencyId });
      if (!exists) throw new NotFoundError('Emergency record');
      throw new AppError('SOS already acknowledged or resolved', 400);
    }

    EventBridge.publish('safety-events', { eventType: 'sos.updated', data: { emergencyId: record._id, change: 'acknowledged' } });
    void tellUser(refId(record.triggeredBy), {
      emergencyId: String(record._id),
      change: 'acknowledged',
      title: phrase('sos.user.acknowledgedTitle'),
      body: admin?.name
        ? phrase('sos.user.acknowledgedNamed', { name: firstName(admin.name) })
        : phrase('sos.user.acknowledged'),
    });
    return record;
  }

  /**
   * Closes an incident with a note. A false alarm's record is kept for 90
   * days (for the false-alarm count), a real incident's is kept. The user,
   * and any contacts who were texted, are told it is closed.
   */
  async resolveSOS(emergencyId: string, adminId: string, notes: string, isFalseAlarm: boolean): Promise<IEmergencyRecord> {
    const now = new Date();
    const record = await EmergencyRecord.findOneAndUpdate(
      { _id: emergencyId, status: { $in: OPEN } },
      {
        $set: {
          status: isFalseAlarm ? SOSStatus.FALSE_ALARM : SOSStatus.RESOLVED,
          resolvedAt: now,
          resolutionNotes: notes,
          monitoringState: SOSMonitoringState.RESOLVED,
          ...(isFalseAlarm ? { retentionExpiresAt: new Date(now.getTime() + safetyConfig().falseAlarmRetentionDays * DAY) } : {}),
        },
        $unset: { openKey: 1, nextCheckInAt: 1, ...(isFalseAlarm ? {} : { retentionExpiresAt: 1 }) },
        $push: { timeline: { event: isFalseAlarm ? 'Resolved as false alarm' : 'SOS resolved', timestamp: now, details: notes } },
      },
      { new: true },
    );
    if (!record) {
      const exists = await EmergencyRecord.exists({ _id: emergencyId });
      if (!exists) throw new NotFoundError('Emergency record');
      throw new AppError('This SOS is already closed', 409, 'SOS_CLOSED');
    }
    if (!record.adminAssignee) {
      await EmergencyRecord.updateOne({ _id: record._id }, { $set: { adminAssignee: new Types.ObjectId(adminId) } });
    }

    EventBridge.publish('safety-events', {
      eventType: 'sos.resolved',
      data: { emergencyId, resolvedBy: adminId, isFalseAlarm },
    });
    void endSosVideo(emergencyId);
    void tellUser(refId(record.triggeredBy), {
      emergencyId: String(record._id),
      change: 'resolved',
      title: phrase('sos.user.closedTitle'),
      body: phrase('sos.user.closedBody', { number: REGION.emergency.general }),
    });
    if (record.emergencyContactsNotified.length) {
      const user = await User.findById(record.triggeredBy).select('name language').lean();
      void textPeople(
        record.emergencyContactsNotified.map((c) => c.phone),
        withEnglish(user?.language, phrase('sos.contacts.closed', { name: firstName(user?.name) })),
      );
    }
    return record;
  }

  /** Admin action: record that police were called. */
  async notifyPolice(emergencyId: string, adminId: string, notes?: string): Promise<IEmergencyRecord> {
    const record = await EmergencyRecord.findById(emergencyId);
    if (!record) throw new NotFoundError('Emergency record');

    record.policeNotifiedAt = new Date();
    record.adminAssignee = record.adminAssignee ?? new Types.ObjectId(adminId);
    record.timeline.push({ event: 'Police notified by admin', timestamp: new Date(), details: notes || '' });
    await record.save();

    EventBridge.publish('safety-events', {
      eventType: 'sos.police_notified',
      data: { emergencyId: record._id, notifiedBy: adminId, notes: notes || '', timestamp: Date.now() },
    });
    return record;
  }

  /** Open incidents, newest first (the app's admin screen). */
  async getActiveIncidents(page: number, limit: number) {
    const filter = { status: { $in: OPEN } };
    const [records, total] = await Promise.all([
      EmergencyRecord.find(filter)
        .populate('triggeredBy', 'name phone')
        .populate('booking', 'ride rider driver')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      EmergencyRecord.countDocuments(filter),
    ]);
    return { records, total, page, limit };
  }

  /**
   * One incident, for the person who raised it or an admin. The other
   * person on the ride cannot read it: they may be the reason for it.
   */
  async getSOSStatus(emergencyId: string, userId: string): Promise<IEmergencyRecord> {
    const record = await EmergencyRecord.findById(emergencyId)
      .populate('triggeredBy', 'name phone')
      .populate('booking', 'ride rider driver pickup dropoff');
    if (!record) throw new NotFoundError('Emergency record');
    if (refId(record.triggeredBy) !== userId && !(await this.isAdmin(userId))) {
      throw new AuthorizationError('You do not have access to this SOS record');
    }
    return record;
  }

  // ─── Monitoring (jobs/SosMonitor.ts) ───────────────────────────────────────

  /**
   * One pass of the SOS monitor: texts contacts whose window has passed,
   * marks phones that went quiet, and pages the team again for SOS nobody
   * has taken. Returns what it did, for logs and tests.
   */
  async monitor(now = new Date()): Promise<{ contacts: number; lostContact: number; repaged: number }> {
    const done = { contacts: 0, lostContact: 0, repaged: 0 };

    const due = await EmergencyRecord.find({ contactsState: 'pending', contactsDueAt: { $lte: now }, status: { $in: OPEN } }).select('_id').lean();
    for (const { _id } of due) {
      if (await this.sendContactAlerts(String(_id), now)) done.contacts++;
    }

    const quiet = await EmergencyRecord.find({
      status: { $in: OPEN },
      nextCheckInAt: { $lt: now },
      userSafeAt: { $exists: false },
    });
    for (const record of quiet) {
      const intervalMs = Math.max(intervalSeconds(record.riskLevel), 15) * 1000;
      const overdue = Math.floor((now.getTime() - record.nextCheckInAt!.getTime()) / intervalMs) + 1;
      record.missedCheckIns += overdue;
      record.nextCheckInAt = new Date(record.nextCheckInAt!.getTime() + overdue * intervalMs);
      if (record.missedCheckIns >= MISSED_BEFORE_LOST && !record.lostContactAt) {
        const since = record.lastCheckInAt ?? record.createdAt;
        const mins = Math.max(1, Math.round((now.getTime() - since.getTime()) / 60_000));
        record.lostContactAt = now;
        record.riskLevel = SOSRiskLevel.HIGH;
        record.monitoringState = SOSMonitoringState.ESCALATED;
        record.checkInIntervalSeconds = intervalSeconds(SOSRiskLevel.HIGH);
        record.escalatedAt = now;
        record.escalationReason = `No position from the phone for ${mins} min. ${batteryReading(record.lastBattery)}`;
        record.timeline.push({ event: 'Phone out of contact', timestamp: now, details: record.escalationReason });
        await record.save();
        EventBridge.publish('safety-events', {
          eventType: 'sos.escalated',
          data: { emergencyId: record._id, reason: record.escalationReason, missedCheckIns: record.missedCheckIns },
        });
        const user = await User.findById(record.triggeredBy).select('name').lean();
        void pageSafetyTeam(String(record._id), `Lost contact with ${user?.name ?? 'the person'}'s phone during their SOS (${mins} min). ${batteryReading(record.lastBattery)}`);
        done.lostContact++;
      } else {
        await record.save();
      }
    }

    const ackTargetMs = safetyConfig().ackTargetMins * 60_000;
    const waiting = await EmergencyRecord.find({
      status: SOSStatus.TRIGGERED,
      $or: [{ lastPagedAt: { $lte: new Date(now.getTime() - ackTargetMs) } }, { lastPagedAt: { $exists: false }, createdAt: { $lte: new Date(now.getTime() - ackTargetMs) } }],
    }).select('_id triggeredBy createdAt pageCount userSafeAt').lean();
    for (const record of waiting) {
      // Claim this page so two instances never both send it
      const claimed = await EmergencyRecord.updateOne(
        { _id: record._id, status: SOSStatus.TRIGGERED, pageCount: record.pageCount ?? 0 },
        {
          $set: { lastPagedAt: now },
          $inc: { pageCount: 1 },
          $push: { timeline: { event: 'Safety team paged again', timestamp: now, details: 'Nobody has taken this SOS yet' } },
        },
      );
      if (!claimed.modifiedCount) continue;
      const user = await User.findById(record.triggeredBy).select('name').lean();
      const mins = Math.round((now.getTime() - new Date(record.createdAt).getTime()) / 60_000);
      const safe = record.userSafeAt ? ' They say they are safe.' : '';
      const whose = user?.name ? `${user.name}'s SOS` : 'an SOS';
      void pageSafetyTeam(String(record._id), `Nobody has taken ${whose} after ${mins} min.${safe} Open it now`);
      done.repaged++;
    }
    return done;
  }

  // ─── Public tracking page ──────────────────────────────────────────────────

  /**
   * What the link in the SOS text shows. The token is the only credential,
   * and it goes only to the person's own emergency contacts, so it shows what
   * they would need to tell the police: first names, the car and its plate,
   * the trip, and the last known position. Never phone numbers.
   */
  async getPublicTracking(token: string): Promise<{
    firstName: string;
    status: SOSStatus;
    acknowledged: boolean;
    userSafeAt: Date | null;
    lostContactAt: Date | null;
    lastLocation: Position | null;
    lastUpdatedAt: Date | null;
    resolvedAt: Date | null;
    trip: { from: string; to: string; vehicle: string; otherRole: 'driver' | 'rider'; otherFirstName: string } | null;
    /** The car's latest position, for a rider's SOS: still useful if the phone is lost */
    car: { lat: number; lng: number; at: Date } | null;
  } | null> {
    const tokenDoc = await EmergencyToken.findOne({ token, expiresAt: { $gt: new Date() } });
    if (!tokenDoc) return null;

    const record = await EmergencyRecord.findById(tokenDoc.emergencyId)
      .select('status locationHistory resolvedAt triggeredBy booking ride adminAssignee userSafeAt lostContactAt')
      .populate('triggeredBy', 'name');
    if (!record) return null;

    const last = record.locationHistory[record.locationHistory.length - 1];
    const name = (record.triggeredBy as unknown as { name?: string } | null)?.name ?? '';

    let trip = null;
    let car: { lat: number; lng: number; at: Date } | null = null;
    const [booking, ride] = await Promise.all([
      Booking.findById(record.booking).select('rider driver pickup.address dropoff.address').lean(),
      Ride.findById(record.ride).select('vehicle').lean(),
    ]);
    if (booking) {
      const byRider = String(booking.rider) === refId(record.triggeredBy);
      const [other, driver] = await Promise.all([
        User.findById(byRider ? booking.driver : booking.rider).select('name').lean(),
        User.findById(booking.driver).select('vehicles').lean(),
      ]);
      const theCar = ride ? driver?.vehicles?.find((v) => String(v._id) === String(ride.vehicle.vehicleId)) : undefined;
      const vehicle = [theCar ? `${theCar.color} ${theCar.make} ${theCar.model}` : ride?.vehicle.vehicleType, ride?.vehicle.plateNumber].filter(Boolean).join(', plate ');
      if (byRider && isOpen(record)) {
        const { lastCarPosition } = await import('./TripTrailService');
        car = await lastCarPosition(record.ride).catch(() => null);
      }
      trip = {
        from: booking.pickup.address,
        to: booking.dropoff.address,
        vehicle,
        otherRole: byRider ? 'driver' as const : 'rider' as const,
        otherFirstName: firstName(other?.name),
      };
    }

    return {
      firstName: firstName(name),
      status: record.status,
      acknowledged: record.status === SOSStatus.ACKNOWLEDGED,
      userSafeAt: record.userSafeAt ?? null,
      lostContactAt: record.lostContactAt ?? null,
      lastLocation: last ? { lng: last.location.coordinates[0], lat: last.location.coordinates[1] } : null,
      lastUpdatedAt: last?.timestamp ?? null,
      resolvedAt: record.resolvedAt ?? null,
      trip,
      car,
    };
  }
}
