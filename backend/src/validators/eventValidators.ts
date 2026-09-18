import Joi from 'joi';

/**
 * Schemas for validating Kafka event payloads.
 * Ensures consistent data flow across the event-driven architecture.
 */

export const eventSchemas = {
  // ─── User Events ───────────────────────────────────────────────────────────
  'user.created': Joi.object({
    userId: Joi.string().hex().length(24).required(),
    phone: Joi.string().required(),
    name: Joi.string().required(),
  }),
  'user.updated': Joi.object({
    userId: Joi.string().hex().length(24).required(),
    updates: Joi.object().required(),
  }),

  // ─── Ride Events ───────────────────────────────────────────────────────────
  'ride.created': Joi.object({
    rideId: Joi.string().hex().length(24).required(),
    driverId: Joi.string().hex().length(24).required(),
    pickup: Joi.string().required(),
    dropoff: Joi.string().required(),
    scheduledTime: Joi.date().iso().required(),
  }),
  'ride.cancelled': Joi.object({
    rideId: Joi.string().hex().length(24).required(),
    reason: Joi.string().optional(),
  }),

  // ─── Booking Events ────────────────────────────────────────────────────────
  'booking.created': Joi.object({
    bookingId: Joi.string().hex().length(24).required(),
    rideId: Joi.string().hex().length(24).required(),
    riderId: Joi.string().hex().length(24).required(),
    driverId: Joi.string().hex().length(24).required(),
    seatsBooked: Joi.number().integer().min(1).required(),
  }),
  'booking.confirmed': Joi.object({
    bookingId: Joi.string().hex().length(24).required(),
    riderId: Joi.string().hex().length(24).required(),
  }),
  'booking.cancelled': Joi.object({
    bookingId: Joi.string().hex().length(24).required(),
    riderId: Joi.string().hex().length(24).required(),
    cancelledBy: Joi.string().required(),
    reason: Joi.string().optional(),
  }),

  // ─── Payment Events ────────────────────────────────────────────────────────
  'payment.authorized': Joi.object({
    orderId: Joi.string().required(),
    bookingId: Joi.string().hex().length(24).required(),
    amount: Joi.number().positive().required(),
  }),
  'payment.captured': Joi.object({
    orderId: Joi.string().required(),
    paymentId: Joi.string().required(),
    bookingId: Joi.string().hex().length(24).optional(),
    userId: Joi.string().hex().length(24).optional(),
    amount: Joi.number().positive().optional(),
  }),
  'payment.failed': Joi.object({
    orderId: Joi.string().required(),
    bookingId: Joi.string().hex().length(24).required(),
    userId: Joi.string().hex().length(24).required(),
    amount: Joi.number().positive().required(),
    error: Joi.string().required(),
    paymentId: Joi.string().optional(),
  }),

  // ─── Location Events ───────────────────────────────────────────────────────
  'driver.location.updated': Joi.object({
    bookingId: Joi.string().hex().length(24).required(),
    driverId: Joi.string().hex().length(24).required(),
    riderId: Joi.string().hex().length(24).required(),
    location: Joi.object({
      lng: Joi.number().required(),
      lat: Joi.number().required(),
    }).required(),
    speed: Joi.number().default(0),
    heading: Joi.number().default(0),
    accuracy: Joi.number().default(0),
    timestamp: Joi.number().required(),
  }),

  // ─── Safety Events ─────────────────────────────────────────────────────────
  'sos.triggered': Joi.object({
    emergencyId: Joi.string().hex().length(24).required(),
    bookingId: Joi.string().hex().length(24).required(),
    userId: Joi.string().hex().length(24).required(),
    location: Joi.object({
      lng: Joi.number().required(),
      lat: Joi.number().required(),
    }).required(),
    timestamp: Joi.number().required(),
  }),
  'sos.location.updated': Joi.object({
    emergencyId: Joi.string().hex().length(24).required(),
    location: Joi.object({
      lng: Joi.number().required(),
      lat: Joi.number().required(),
    }).required(),
    timestamp: Joi.number().required(),
  }),
  'sos.escalated': Joi.object({
    emergencyId: Joi.string().hex().length(24).required(),
    reason: Joi.string().required(),
    timestamp: Joi.number().required(),
    missedCheckIns: Joi.number().optional(),
  }),
  'sos.resolved': Joi.object({
    emergencyId: Joi.string().hex().length(24).required(),
    resolvedBy: Joi.string().hex().length(24).optional(),
    resolutionNotes: Joi.string().optional(),
    timestamp: Joi.number().required(),
  }),
  'sos.police_notified': Joi.object({
    emergencyId: Joi.string().hex().length(24).required(),
    notifiedBy: Joi.string().hex().length(24).required(),
    notes: Joi.string().optional(),
    timestamp: Joi.number().required(),
  }),

  // ─── Parcel Events ─────────────────────────────────────────────────────────
  'parcel:created': Joi.object({
    parcelId: Joi.string().hex().length(24).required(),
    rideId: Joi.string().hex().length(24).required(),
  }),
  'parcel:accepted': Joi.object({
    parcelId: Joi.string().hex().length(24).required(),
    driverId: Joi.string().hex().length(24).required(),
  }),
  'parcel:picked_up': Joi.object({
    parcelId: Joi.string().hex().length(24).required(),
  }),
  'parcel:completed': Joi.object({
    parcelId: Joi.string().hex().length(24).required(),
  }),
  'parcel:cancelled': Joi.object({
    parcelId: Joi.string().hex().length(24).required(),
  }),
};
