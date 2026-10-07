import { Types } from 'mongoose';

jest.mock('../../config/kafka', () => ({
  getKafkaProducer: jest.fn(() => ({ send: jest.fn().mockResolvedValue(undefined) })),
  createKafkaConsumer: jest.fn(),
}));

import { EventBridge } from '../../events';
import { logger } from '../../utils/logger';
import type { KafkaTopic } from '../../types';
import { inEnglish } from '../setup/english';

const id = () => new Types.ObjectId();
const place = { location: { type: 'Point', coordinates: [72.87, 19.11] }, address: 'Andheri East, Mumbai' };

// Payloads shaped exactly as the services publish them (ObjectIds, Dates and
// extra fields included). In production an event that fails validation is
// dropped, and with it the notification or admin SOS alert it drives.
const published: Array<[KafkaTopic, string, Record<string, unknown>]> = [
  ['booking-events', 'booking.created', { bookingId: id(), rideId: id().toString(), riderId: id().toString(), driverId: id().toString(), seatsBooked: 1, paidViaWallet: true }],
  ['booking-events', 'booking.confirmed', { bookingId: id(), riderId: id(), driverId: id() }],
  ['booking-events', 'booking.cancelled', { bookingId: id(), riderId: id(), cancelledBy: id(), reason: '' }],
  ['ride-events', 'ride.created', { rideId: id(), driverId: id().toString(), pickup: place, dropoff: place, departureTime: new Date() }],
  ['ride-events', 'ride.cancelled', { rideId: id(), driverId: id(), reason: 'car broke down' }],
  ['safety-events', 'sos.triggered', { emergencyId: id(), bookingId: id().toString(), triggeredBy: id().toString(), location: { lng: 72.87, lat: 19.11 }, liveTrackingUrl: 'https://siham.app/t/x' }],
  ['location-events', 'sos.location.updated', { emergencyId: id().toString(), location: { lng: 72.87, lat: 19.11 }, timestamp: new Date().toISOString() }],
  ['safety-events', 'sos.escalated', { emergencyId: id(), bookingId: id(), triggeredBy: id(), reason: 'missed check-ins', missedCheckIns: 2 }],
  ['safety-events', 'sos.resolved', { emergencyId: id(), resolvedBy: id().toString(), isFalseAlarm: false, checkInStatus: 'ok' }],
  ['safety-events', 'sos.police_notified', { emergencyId: id(), notifiedBy: id().toString() }],
  ['location-events', 'driver.location.updated', { bookingId: id().toString(), driverId: id().toString(), riderId: id().toString(), location: { lng: 72.87, lat: 19.11 }, speed: 30, heading: 90, accuracy: 5, timestamp: Date.now() }],
];

describe('EventBridge.publish', () => {
  test.each(published)('%s %s passes validation as published', (topic, eventType, data) => {
    const error = jest.spyOn(logger, 'error').mockImplementation(() => logger);

    EventBridge.publish(topic, { eventType, data } as Parameters<typeof EventBridge.publish>[1]);

    const failures = error.mock.calls.filter(([msg]) => String(msg) === 'Kafka event validation failed');
    expect(failures).toEqual([]);
    error.mockRestore();
  });
});

describe('EventBridge without Kafka', () => {
  it('handles an event in-process when the producer is not connected, so the push still goes out', async () => {
    const kafka = jest.requireMock('../../config/kafka') as { getKafkaProducer: jest.Mock };
    kafka.getKafkaProducer.mockImplementationOnce(() => { throw new Error('Kafka producer not initialized'); });
    const { NotificationService } = await import('../../services/NotificationService');
    const push = jest.spyOn(NotificationService.prototype, 'sendPushNotification').mockResolvedValue(undefined as never);

    const riderId = id().toString();
    await EventBridge.dispatchLocally('booking-events', {
      eventType: 'booking.confirmed',
      data: { bookingId: id().toString(), riderId },
      timestamp: new Date().toISOString(),
      source: 'test',
      correlationId: 'c1',
    } as never);

    expect(push).toHaveBeenCalledWith(riderId, inEnglish('Booking Confirmed'), expect.anything(), expect.anything());
    push.mockRestore();
  });

  it('falls back to in-process handling when publishing fails', async () => {
    const kafka = jest.requireMock('../../config/kafka') as { getKafkaProducer: jest.Mock };
    kafka.getKafkaProducer.mockImplementation(() => { throw new Error('Kafka producer not initialized'); });
    const local = jest.spyOn(EventBridge, 'dispatchLocally').mockResolvedValue();

    EventBridge.publish('booking-events', {
      eventType: 'booking.confirmed',
      data: { bookingId: id().toString(), riderId: id().toString() },
    });
    await new Promise((r) => setTimeout(r, 50));

    expect(local).toHaveBeenCalledWith('booking-events', expect.objectContaining({ eventType: 'booking.confirmed' }));
    local.mockRestore();
    kafka.getKafkaProducer.mockReset();
  });
});
