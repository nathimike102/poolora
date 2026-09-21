import { v4 as uuidv4 } from 'uuid';
import { EmergencyRecord, IEmergencyRecord } from '../models/EmergencyRecord';
import { EmergencyToken } from '../models/EmergencyToken';
import { Booking } from '../models/Booking';
import { User } from '../models/User';
import { BookingStatus, SOSStatus, SOSRiskLevel, SOSMonitoringState, SOSCheckInStatus, UserCapability } from '../types';
import { AppError, NotFoundError, AuthorizationError } from '../utils/AppError';
import { toGeoPoint } from '../utils/helpers';
import { EventBridge } from '../events';
import { logger } from '../utils/logger';
import { config } from '../config';
import axios from 'axios';
import { Types } from 'mongoose';

type SafetyConfig = {
  trackingTokenTtlSeconds?: number;
  retentionDays?: number;
};

function getSafetyConfig(): SafetyConfig {
  return (config as typeof config & { safety?: SafetyConfig }).safety ?? {};
}

/** Returns the id of a ref whether or not it has been populated. */
function refId(ref: unknown): string {
  const value = (ref as { _id?: unknown } | null)?._id ?? ref;
  return String(value);
}

export class SafetyService {
  private async isAdmin(userId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(userId)) return false;
    const user = await User.findById(userId).select('capabilities');
    return Boolean(user?.capabilities?.includes(UserCapability.ADMIN));
  }

  /** Only the user who raised the SOS may feed it live data (location, evidence). */
  private assertTriggerer(record: IEmergencyRecord, userId: string): void {
    if (refId(record.triggeredBy) !== userId) {
      throw new AuthorizationError('You do not have access to update this SOS record');
    }
  }

  private getMonitoringIntervalSeconds(riskLevel: SOSRiskLevel): number {
    if (riskLevel === SOSRiskLevel.HIGH) return 30;
    if (riskLevel === SOSRiskLevel.MEDIUM) return 60;
    return 120;
  }

  private async autoEscalateIfOverdue(record: IEmergencyRecord): Promise<IEmergencyRecord> {
    if ([SOSStatus.RESOLVED, SOSStatus.FALSE_ALARM].includes(record.status)) {
      return record;
    }

    const nextCheckInAt = record.nextCheckInAt?.getTime();
    if (!nextCheckInAt) {
      return record;
    }

    const now = Date.now();
    if (now <= nextCheckInAt) {
      return record;
    }

    const intervalMs = Math.max(record.checkInIntervalSeconds, 30) * 1000;
    const overdueCycles = Math.floor((now - nextCheckInAt) / intervalMs) + 1;
    record.missedCheckIns += overdueCycles;
    record.lastCheckInAt = record.lastCheckInAt ?? new Date(nextCheckInAt);
    record.nextCheckInAt = new Date(nextCheckInAt + overdueCycles * intervalMs);

    if (record.missedCheckIns >= 3 && record.status === SOSStatus.TRIGGERED) {
      record.status = SOSStatus.ACKNOWLEDGED;
      record.riskLevel = SOSRiskLevel.HIGH;
      record.monitoringState = SOSMonitoringState.ESCALATED;
      record.escalatedAt = new Date();
      record.escalationReason = 'No response to 3 consecutive safety check-ins';
      record.timeline.push({
        event: 'Emergency auto-escalated',
        timestamp: new Date(),
        details: record.escalationReason,
      });

      EventBridge.publish('safety-events', {
        eventType: 'sos.escalated',
        data: {
          emergencyId: record._id,
          bookingId: record.booking,
          triggeredBy: record.triggeredBy,
          reason: record.escalationReason,
          missedCheckIns: record.missedCheckIns,
        },
      });
    }

    await record.save();
    return record;
  }

  /**
   * Admin action: notify police for an incident.
   */
  async notifyPolice(emergencyId: string, adminId: string, notes?: string): Promise<IEmergencyRecord> {
    const record = await EmergencyRecord.findById(emergencyId);
    if (!record) throw new NotFoundError('Emergency record');

    record.policeNotifiedAt = new Date();
    record.adminAssignee = new Types.ObjectId(adminId);
    record.timeline.push({
      event: 'Police notified by admin',
      timestamp: new Date(),
      details: notes || '',
    });

    await record.save();

    await EventBridge.publish('safety-events', {
      eventType: 'sos.police_notified',
      data: {
        emergencyId: record._id,
        notifiedBy: adminId,
        notes: notes || '',
        timestamp: Date.now(),
      },
    });

    return record;
  }

  /**
   * Trigger SOS emergency. High-priority endpoint.
   * - Records GPS location
   * - Starts high-frequency tracking
   * - Notifies emergency contacts via SMS
   * - Alerts admin dashboard in real-time
   */
  async triggerSOS(
    userId: string,
    data: {
      bookingId: string;
      location: { lng: number; lat: number };
    },
  ): Promise<IEmergencyRecord> {
    const booking = await Booking.findById(data.bookingId).populate('ride');
    if (!booking) throw new NotFoundError('Booking');

    // Verify user is part of the booking
    const isRider = booking.rider.toString() === userId;
    const isDriver = booking.driver.toString() === userId;
    if (!isRider && !isDriver) {
      throw new AuthorizationError('You are not part of this booking');
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new AppError('SOS only available for active (confirmed) bookings', 400);
    }

    // Check for existing active SOS on this booking
    const existingSOS = await EmergencyRecord.findOne({
      booking: data.bookingId,
      status: { $in: [SOSStatus.TRIGGERED, SOSStatus.ACKNOWLEDGED] },
    });
    if (existingSOS) {
      throw new AppError('Active SOS already exists for this booking', 409);
    }

    const triggerLocation = toGeoPoint(data.location.lng, data.location.lat);

    // Get user's emergency contacts
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('User');

    const now = new Date();

    // Persist the tracking token before anything is sent, so the link in the
    // SMS works the moment it arrives.
    const emergencyId = new Types.ObjectId();
    const token = uuidv4();
    const liveTrackingUrl = `${config.app.baseUrl}/track/sos/${token}`;
    try {
      const tokenTtlSeconds = getSafetyConfig().trackingTokenTtlSeconds ?? 24 * 3600;
      await EmergencyToken.create({
        token,
        emergencyId,
        expiresAt: new Date(now.getTime() + tokenTtlSeconds * 1000),
      });
    } catch (err) {
      logger.error('Failed to persist emergency token', { error: (err as Error).message });
    }

    const retentionDays = getSafetyConfig().retentionDays ?? 30;
    const emergencyRecord = await EmergencyRecord.create({
      _id: emergencyId,
      booking: data.bookingId,
      ride: booking.ride,
      triggeredBy: userId,
      status: SOSStatus.TRIGGERED,
      triggerLocation,
      locationHistory: [{ location: triggerLocation, timestamp: now }],
      audioRecordingUrls: [],
      screenshotUrls: [],
      riskLevel: SOSRiskLevel.LOW,
      monitoringState: SOSMonitoringState.ACTIVE,
      checkInIntervalSeconds: this.getMonitoringIntervalSeconds(SOSRiskLevel.LOW),
      lastCheckInAt: now,
      nextCheckInAt: new Date(now.getTime() + this.getMonitoringIntervalSeconds(SOSRiskLevel.LOW) * 1000),
      missedCheckIns: 0,
      emergencyContactsNotified: [],
      adminNotifiedAt: now,
      liveTrackingUrl,
      retentionExpiresAt: new Date(now.getTime() + retentionDays * 24 * 3600 * 1000),
      timeline: [
        { event: 'SOS triggered', timestamp: now, details: `By ${isRider ? 'rider' : 'driver'}` },
        { event: 'Emergency monitoring started', timestamp: now, details: 'Initial risk level: LOW' },
        { event: 'Admin dashboard alerted', timestamp: now },
      ],
    });

    // Send SMS alerts to emergency contacts via Twilio. Only contacts whose
    // message was accepted are recorded as notified.
    const twilioConfigured = Boolean(
      config.twilio.accountSid &&
      config.twilio.authToken &&
      config.twilio.phoneNumber &&
      !config.twilio.accountSid.includes('XXXXXXXXXXXXXXXX') &&
      config.twilio.authToken !== 'CHANGE_ME' &&
      !config.twilio.phoneNumber.includes('XXXXXXXXXX'),
    );

    const contacts = user.emergencyContacts ?? [];
    let notifiedCount = 0;
    if (twilioConfigured) {
      for (const contact of contacts) {
        try {
          const body = new URLSearchParams({
            To: contact.phone,
            From: config.twilio.phoneNumber,
            Body: `Poolora SOS: ${user.name} has raised an emergency alert during a ride. See their live location: ${liveTrackingUrl} If you think they are in danger, call 112.`,
          });
          await axios.post(
            `https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`,
            body.toString(),
            {
              auth: { username: config.twilio.accountSid, password: config.twilio.authToken },
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              timeout: 10000,
            },
          );
          emergencyRecord.emergencyContactsNotified?.push({
            name: contact.name,
            phone: contact.phone,
            notifiedAt: new Date(),
            method: 'sms',
          });
          notifiedCount += 1;
          logger.info('SOS SMS sent to emergency contact', { contact: contact.phone.slice(-4), emergencyId });
        } catch (smsError) {
          logger.error('Failed to send SOS SMS to emergency contact', {
            contact: contact.phone.slice(-4),
            error: (smsError as Error).message,
          });
          // Non-fatal: continue with other contacts even if one fails
        }
      }
    } else {
      logger.warn('Twilio not configured — SOS SMS alerts not sent', { userId });
    }

    emergencyRecord.timeline?.push({
      event: twilioConfigured ? 'Emergency contacts notified' : 'Emergency contact SMS unavailable',
      timestamp: new Date(),
      details: `${notifiedCount} of ${contacts.length} contacts reached by SMS`,
    });
    if (typeof emergencyRecord.save === 'function') {
      await emergencyRecord.save();
    }

    // Publish high-priority Kafka event
    EventBridge.publish('safety-events', {
      eventType: 'sos.triggered',
      data: {
        emergencyId: emergencyRecord._id,
        bookingId: data.bookingId,
        triggeredBy: userId,
        location: data.location,
        liveTrackingUrl,
      },
    });

    logger.warn('SOS TRIGGERED', {
      emergencyId: emergencyRecord._id,
      userId,
      bookingId: data.bookingId,
    });

    return emergencyRecord;
  }

  /**
   * Update SOS location during high-frequency tracking.
   */
  async updateSOSLocation(
    emergencyId: string,
    userId: string,
    location: { lng: number; lat: number },
  ): Promise<void> {
    const record = await EmergencyRecord.findById(emergencyId);
    if (!record) throw new NotFoundError('Emergency record');
    this.assertTriggerer(record, userId);

    if ([SOSStatus.RESOLVED, SOSStatus.FALSE_ALARM].includes(record.status)) {
      return;
    }

    record.locationHistory.push({
      location: toGeoPoint(location.lng, location.lat),
      timestamp: new Date(),
    });
    record.lastCheckInAt = new Date();
    record.missedCheckIns = 0;
    record.nextCheckInAt = new Date(
      Date.now() + this.getMonitoringIntervalSeconds(record.riskLevel) * 1000,
    );

    if (record.riskLevel !== SOSRiskLevel.LOW && record.status === SOSStatus.TRIGGERED) {
      record.riskLevel = SOSRiskLevel.MEDIUM;
      record.checkInIntervalSeconds = this.getMonitoringIntervalSeconds(SOSRiskLevel.MEDIUM);
    }

    record.timeline.push({
      event: 'Live location updated',
      timestamp: new Date(),
      details: 'Monitoring window refreshed',
    });

    await record.save();

    EventBridge.publish('location-events', {
      eventType: 'sos.location.updated',
      data: {
        emergencyId,
        location,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Upload evidence (audio/screenshot) during SOS.
   */
  async addEvidence(
    emergencyId: string,
    userId: string,
    type: 'audio' | 'screenshot',
    url: string,
  ): Promise<void> {
    const record = await EmergencyRecord.findById(emergencyId);
    if (!record) throw new NotFoundError('Emergency record');
    this.assertTriggerer(record, userId);

    const evidenceField = type === 'audio' ? 'audioRecordingUrls' : 'screenshotUrls';
    record[evidenceField].push(url);
    record.timeline.push({
      event: `${type} evidence uploaded`,
      timestamp: new Date(),
    });
    await record.save();
  }

  /**
   * Record a user check-in during SOS monitoring.
   */
  async updateSOSCheckIn(
    emergencyId: string,
    userId: string,
    data: {
      status: SOSCheckInStatus;
      notes?: string;
      location?: { lng: number; lat: number };
    },
  ): Promise<IEmergencyRecord> {
    const record = await EmergencyRecord.findById(emergencyId);
    if (!record) throw new NotFoundError('Emergency record');

    const isTriggerer = refId(record.triggeredBy) === userId;
    if (!isTriggerer && !(await this.isAdmin(userId))) {
      throw new AuthorizationError('You do not have access to update this SOS record');
    }

    if ([SOSStatus.RESOLVED, SOSStatus.FALSE_ALARM].includes(record.status)) {
      throw new AppError('SOS already closed', 400);
    }

    const now = new Date();
    record.lastCheckInAt = now;
    record.missedCheckIns = 0;

    if (data.location) {
      record.locationHistory.push({
        location: toGeoPoint(data.location.lng, data.location.lat),
        timestamp: now,
      });
    }

    if (data.status === SOSCheckInStatus.OK) {
      record.status = SOSStatus.RESOLVED;
      record.monitoringState = SOSMonitoringState.RESOLVED;
      record.riskLevel = SOSRiskLevel.LOW;
      record.resolvedAt = now;
      record.nextCheckInAt = undefined;
      record.escalationReason = undefined;
      record.timeline.push({
        event: 'User confirmed safe',
        timestamp: now,
        details: data.notes,
      });

      EventBridge.publish('safety-events', {
        eventType: 'sos.resolved',
        data: {
          emergencyId: record._id,
          resolvedBy: userId,
          isFalseAlarm: false,
          checkInStatus: data.status,
        },
      });
    } else {
      record.status = SOSStatus.ACKNOWLEDGED;
      record.monitoringState = SOSMonitoringState.ESCALATED;
      record.riskLevel = data.status === SOSCheckInStatus.NOT_OK ? SOSRiskLevel.HIGH : SOSRiskLevel.MEDIUM;
      record.checkInIntervalSeconds = this.getMonitoringIntervalSeconds(record.riskLevel);
      record.nextCheckInAt = new Date(now.getTime() + record.checkInIntervalSeconds * 1000);
      record.escalatedAt = now;
      record.escalationReason = data.notes || (data.status === SOSCheckInStatus.NOT_OK
        ? 'User reported unsafe situation'
        : 'User requested continued monitoring');
      record.timeline.push({
        event: data.status === SOSCheckInStatus.NOT_OK ? 'User reported danger' : 'User requested continued monitoring',
        timestamp: now,
        details: data.notes,
      });

      EventBridge.publish('safety-events', {
        eventType: 'sos.escalated',
        data: {
          emergencyId: record._id,
          bookingId: record.booking,
          triggeredBy: record.triggeredBy,
          reason: record.escalationReason,
          checkInStatus: data.status,
        },
      });
    }

    await record.save();
    return record;
  }

  /**
   * Admin acknowledges the SOS.
   */
  async acknowledgeSOS(emergencyId: string, adminId: string): Promise<IEmergencyRecord> {
    const record = await EmergencyRecord.findById(emergencyId);
    if (!record) throw new NotFoundError('Emergency record');
    if (record.status !== SOSStatus.TRIGGERED) {
      throw new AppError('SOS already acknowledged or resolved', 400);
    }

    record.status = SOSStatus.ACKNOWLEDGED;
    record.adminAssignee = new Types.ObjectId(adminId);
    record.monitoringState = SOSMonitoringState.ESCALATED;
    record.riskLevel = SOSRiskLevel.HIGH;
    record.timeline.push({
      event: 'Admin acknowledged SOS',
      timestamp: new Date(),
      details: `Admin: ${adminId}`,
    });

    await record.save();
    return record;
  }

  /**
   * Resolve an SOS incident.
   */
  async resolveSOS(
    emergencyId: string,
    adminId: string,
    notes: string,
    isFalseAlarm: boolean,
  ): Promise<IEmergencyRecord> {
    const record = await EmergencyRecord.findById(emergencyId);
    if (!record) throw new NotFoundError('Emergency record');

    record.status = isFalseAlarm ? SOSStatus.FALSE_ALARM : SOSStatus.RESOLVED;
    record.resolvedAt = new Date();
    record.resolutionNotes = notes;
    record.monitoringState = SOSMonitoringState.RESOLVED;
    record.riskLevel = SOSRiskLevel.LOW;
    record.nextCheckInAt = undefined;
    record.timeline.push({
      event: isFalseAlarm ? 'Resolved as false alarm' : 'SOS resolved',
      timestamp: new Date(),
      details: notes,
    });

    await record.save();

    EventBridge.publish('safety-events', {
      eventType: 'sos.resolved',
      data: { emergencyId, resolvedBy: adminId, isFalseAlarm },
    });

    return record;
  }

  /**
   * Get active SOS incidents (for admin dashboard).
   */
  async getActiveIncidents(page: number, limit: number) {
    const filter = { status: { $in: [SOSStatus.TRIGGERED, SOSStatus.ACKNOWLEDGED] } };

    const records = await EmergencyRecord.find(filter)
      .populate('triggeredBy', 'name phone')
      .populate('booking', 'ride rider driver')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await EmergencyRecord.countDocuments(filter);

    await Promise.all(records.map((record: IEmergencyRecord) => this.autoEscalateIfOverdue(record)));

    return { records, total, page, limit };
  }

  /**
   * Get SOS status by emergency record ID.
   * Returns the current state, location history, and timeline.
   */
  async getSOSStatus(emergencyId: string, userId: string): Promise<IEmergencyRecord> {
    const record = await EmergencyRecord.findById(emergencyId)
      .populate('triggeredBy', 'name phone')
      .populate('booking', 'ride rider driver pickup dropoff');

    if (!record) throw new NotFoundError('Emergency record');

    // Only the trigger user, the booking counterpart, or an admin may read it.
    // Authorize before escalation so unauthorized reads cannot mutate the record.
    const booking = await Booking.findById(refId(record.booking));
    const participants = [refId(record.triggeredBy)];
    if (booking) participants.push(refId(booking.rider), refId(booking.driver));
    if (!participants.includes(userId) && !(await this.isAdmin(userId))) {
      throw new AuthorizationError('You do not have access to this SOS record');
    }

    await this.autoEscalateIfOverdue(record);
    return record;
  }

  /**
   * Public view for the SMS tracking link. The token is the only credential,
   * so this returns just what a worried contact needs: first name, status and
   * last known position. No phone numbers, booking or driver details.
   */
  async getPublicTracking(token: string): Promise<{
    firstName: string;
    status: SOSStatus;
    lastLocation: { lat: number; lng: number } | null;
    lastUpdatedAt: Date | null;
    resolvedAt: Date | null;
  } | null> {
    const tokenDoc = await EmergencyToken.findOne({ token, expiresAt: { $gt: new Date() } });
    if (!tokenDoc) return null;

    const record = await EmergencyRecord.findById(tokenDoc.emergencyId)
      .select('status locationHistory resolvedAt triggeredBy')
      .populate('triggeredBy', 'name');
    if (!record) return null;

    const last = record.locationHistory[record.locationHistory.length - 1];
    const name = (record.triggeredBy as unknown as { name?: string } | null)?.name ?? '';

    return {
      firstName: name.trim().split(/\s+/)[0] || 'Your contact',
      status: record.status,
      lastLocation: last
        ? { lng: last.location.coordinates[0], lat: last.location.coordinates[1] }
        : null,
      lastUpdatedAt: last?.timestamp ?? null,
      resolvedAt: record.resolvedAt ?? null,
    };
  }

  /**
   * Get emergency contacts for a user.
   */
  async getEmergencyContacts(userId: string) {
    const user = await User.findById(userId).select('emergencyContacts');
    if (!user) throw new NotFoundError('User');
    return user.emergencyContacts;
  }

  /**
   * Update emergency contacts for a user.
   */
  async updateEmergencyContacts(
    userId: string,
    contacts: Array<{ name: string; phone: string; relation: string }>,
  ) {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { emergencyContacts: contacts } },
      { new: true, runValidators: true },
    ).select('emergencyContacts');

    if (!user) throw new NotFoundError('User');
    return user.emergencyContacts;
  }
}
