import { v4 as uuidv4 } from 'uuid';
import { EmergencyRecord, IEmergencyRecord } from '../models/EmergencyRecord';
import { Booking } from '../models/Booking';
import { User } from '../models/User';
import { BookingStatus, SOSStatus } from '../types';
import { AppError, NotFoundError, AuthorizationError } from '../utils/AppError';
import { toGeoPoint } from '../utils/helpers';
import { EventBridge } from '../events';
import { logger } from '../utils/logger';
import { config } from '../config';
import axios from 'axios';

export class SafetyService {
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
    const liveTrackingUrl = `${config.app.baseUrl}/track/sos/${uuidv4()}`;

    // Get user's emergency contacts
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('User');

    const now = new Date();

    // Send SMS alerts to emergency contacts via Twilio
    const twilioConfigured = Boolean(
      config.twilio.accountSid &&
      config.twilio.authToken &&
      config.twilio.phoneNumber &&
      !config.twilio.accountSid.includes('XXXXXXXXXXXXXXXX') &&
      config.twilio.authToken !== 'CHANGE_ME' &&
      !config.twilio.phoneNumber.includes('XXXXXXXXXX'),
    );

    if (twilioConfigured) {
      for (const contact of user.emergencyContacts) {
        try {
          const body = new URLSearchParams({
            To: contact.phone,
            From: config.twilio.phoneNumber,
            Body: `🚨 EMERGENCY: ${user.name} has triggered an SOS alert. Track their live location: ${liveTrackingUrl}`,
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
          logger.info('SOS SMS sent to emergency contact', { contact: contact.phone, emergencyId: liveTrackingUrl });
        } catch (smsError) {
          logger.error('Failed to send SOS SMS to emergency contact', {
            contact: contact.phone,
            error: (smsError as Error).message,
          });
          // Non-fatal: continue with other contacts even if one fails
        }
      }
    } else {
      logger.warn('Twilio not configured — SOS SMS alerts not sent', { userId });
    }

    const emergencyRecord = await EmergencyRecord.create({
      booking: data.bookingId,
      ride: booking.ride,
      triggeredBy: userId,
      status: SOSStatus.TRIGGERED,
      triggerLocation,
      locationHistory: [{ location: triggerLocation, timestamp: now }],
      audioRecordingUrls: [],
      screenshotUrls: [],
      emergencyContactsNotified: user.emergencyContacts.map((contact) => ({
        name: contact.name,
        phone: contact.phone,
        notifiedAt: now,
        method: 'sms' as const,
      })),
      adminNotifiedAt: now,
      liveTrackingUrl,
      timeline: [
        { event: 'SOS triggered', timestamp: now, details: `By ${isRider ? 'rider' : 'driver'}` },
        { event: 'Emergency contacts notified', timestamp: now },
        { event: 'Admin dashboard alerted', timestamp: now },
      ],
    });

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
    location: { lng: number; lat: number },
  ): Promise<void> {
    // Use atomic $push instead of read → modify → save for better performance
    const result = await EmergencyRecord.findOneAndUpdate(
      {
        _id: emergencyId,
        status: { $nin: [SOSStatus.RESOLVED, SOSStatus.FALSE_ALARM] },
      },
      {
        $push: {
          locationHistory: {
            location: toGeoPoint(location.lng, location.lat),
            timestamp: new Date(),
          },
        },
      },
    );

    if (!result) {
      // Either record doesn't exist or is already resolved — silently ignore
      return;
    }

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
    type: 'audio' | 'screenshot',
    url: string,
  ): Promise<void> {
    const evidenceField = type === 'audio' ? 'audioRecordingUrls' : 'screenshotUrls';

    const record = await EmergencyRecord.findByIdAndUpdate(emergencyId, {
      $push: {
        [evidenceField]: url,
        timeline: {
          event: `${type} evidence uploaded`,
          timestamp: new Date(),
        },
      },
    });

    if (!record) throw new NotFoundError('Emergency record');
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
    record.adminAssignee = adminId as any;
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
   * Get SOS status by emergency record ID.
   * Returns the current state, location history, and timeline.
   */
  async getSOSStatus(emergencyId: string, userId: string): Promise<IEmergencyRecord> {
    const record = await EmergencyRecord.findById(emergencyId)
      .populate('triggeredBy', 'name phone')
      .populate('booking', 'ride rider driver pickup dropoff');

    if (!record) throw new NotFoundError('Emergency record');

    // Only allow access to the trigger user, the booking counterpart, or admin
    const booking = await Booking.findById(record.booking);
    if (booking) {
      const isRider = booking.rider.toString() === userId;
      const isDriver = booking.driver.toString() === userId;
      const isTriggerer = record.triggeredBy.toString() === userId;
      if (!isRider && !isDriver && !isTriggerer) {
        throw new AuthorizationError('You do not have access to this SOS record');
      }
    }

    return record;
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
