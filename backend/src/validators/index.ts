import Joi from 'joi';
import { VehicleType, RideType, RecurringPattern } from '../types';

// ─── Auth ────────────────────────────────────────────────────────────────────

export const sendOtpSchema = {
  body: Joi.object({
    phone: Joi.string()
      .pattern(/^\+[1-9]\d{7,14}$/)
      .required()
      .messages({ 'string.pattern.base': 'Phone must be in E.164 format (e.g., +919876543210)' }),
  }),
};

export const verifyOtpSchema = {
  body: Joi.object({
    phone: Joi.string()
      .pattern(/^\+[1-9]\d{7,14}$/)
      .required(),
    otp: Joi.string().length(6).required(),
    name: Joi.string().min(2).max(100).when('$isRegistration', {
      is: true,
      then: Joi.required(),
    }),
    email: Joi.string().email().optional(),
    dateOfBirth: Joi.date().iso().optional(),
  }),
};

export const refreshTokenSchema = {
  body: Joi.object({
    refreshToken: Joi.string().required(),
  }),
};

// ─── KYC / Driver Upgrade ────────────────────────────────────────────────────

export const submitKycSchema = {
  body: Joi.object({
    licenseNumber: Joi.string().required().trim(),
    drivingLicenseUrl: Joi.string().uri().required(),
    vehicle: Joi.object({
      make: Joi.string().required().trim(),
      model: Joi.string().required().trim(),
      year: Joi.number().min(2000).max(new Date().getFullYear() + 1).required(),
      color: Joi.string().required().trim(),
      plateNumber: Joi.string().required().uppercase().trim(),
      vehicleType: Joi.string().valid(...Object.values(VehicleType)).required(),
      hasAC: Joi.boolean().default(true),
      registrationDocUrl: Joi.string().uri().required(),
      insuranceDocUrl: Joi.string().uri().required(),
      photos: Joi.array().items(Joi.string().uri()).min(1).required(),
    }).required(),
  }),
};

// ─── Ride ────────────────────────────────────────────────────────────────────

export const createRideSchema = {
  body: Joi.object({
    rideType: Joi.string().valid(...Object.values(RideType)).default(RideType.CAR_POOL),
    vehicleId: Joi.string().hex().length(24).required(),
    pickup: Joi.object({
      lng: Joi.number().min(-180).max(180).required(),
      lat: Joi.number().min(-90).max(90).required(),
      address: Joi.string().required(),
    }).required(),
    dropoff: Joi.object({
      lng: Joi.number().min(-180).max(180).required(),
      lat: Joi.number().min(-90).max(90).required(),
      address: Joi.string().required(),
    }).required(),
    departureTime: Joi.date().iso().greater('now').required(),
    totalSeats: Joi.number().integer().min(1).max(8).required(),
    pricePerSeat: Joi.number().min(0).required(),
    recurring: Joi.string().valid(...Object.values(RecurringPattern)).default(RecurringPattern.NONE),
    preferences: Joi.object({
      womenOnly: Joi.boolean().default(false),
      smokingAllowed: Joi.boolean().default(false),
      petsAllowed: Joi.boolean().default(false),
      luggageSize: Joi.string().valid('none', 'small', 'medium', 'large').default('medium'),
      maxDetourMins: Joi.number().min(0).max(60).default(15),
    }).default(),
    parcelInfo: Joi.object({
      maxWeightKg: Joi.number().min(0).required(),
      maxDimensions: Joi.object({
        length: Joi.number().required(),
        width: Joi.number().required(),
        height: Joi.number().required(),
      }).required(),
      fragile: Joi.boolean().default(false),
    }).optional(),
  }),
};

export const searchRideSchema = {
  query: Joi.object({
    pickupLng: Joi.number().min(-180).max(180).required(),
    pickupLat: Joi.number().min(-90).max(90).required(),
    dropoffLng: Joi.number().min(-180).max(180).required(),
    dropoffLat: Joi.number().min(-90).max(90).required(),
    departureTime: Joi.date().iso().required(),
    radiusKm: Joi.number().min(1).max(50).default(5),
    timeDeviationMins: Joi.number().min(0).max(480).default(120),
    maxPrice: Joi.number().min(0).optional(),
    womenOnly: Joi.boolean().optional(),
    hasAC: Joi.boolean().optional(),
    vehicleType: Joi.string().valid(...Object.values(VehicleType)).optional(),
    minRating: Joi.number().min(1).max(5).optional(),
    rideType: Joi.string().valid(...Object.values(RideType)).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
  }),
};

export const updateDriverLocationSchema = {
  body: Joi.object({
    bookingId: Joi.string().hex().length(24).required(),
    lng: Joi.number().min(-180).max(180).required(),
    lat: Joi.number().min(-90).max(90).required(),
    speed: Joi.number().min(0).max(250).default(0),
    heading: Joi.number().min(0).max(360).default(0),
    accuracy: Joi.number().min(0).max(500).default(0),
    timestamp: Joi.number().integer().positive().optional(),
  }),
};

// ─── Booking ─────────────────────────────────────────────────────────────────

export const createBookingSchema = {
  body: Joi.object({
    rideId: Joi.string().hex().length(24).required(),
    seatsBooked: Joi.number().integer().min(1).max(8).default(1),
    pickup: Joi.object({
      lng: Joi.number().min(-180).max(180).required(),
      lat: Joi.number().min(-90).max(90).required(),
      address: Joi.string().required(),
    }).required(),
    dropoff: Joi.object({
      lng: Joi.number().min(-180).max(180).required(),
      lat: Joi.number().min(-90).max(90).required(),
      address: Joi.string().required(),
    }).required(),
  }),
};

// ─── Rating ──────────────────────────────────────────────────────────────────

export const createRatingSchema = {
  body: Joi.object({
    bookingId: Joi.string().hex().length(24).required(),
    score: Joi.number().integer().min(1).max(5).required(),
    tags: Joi.array().items(
      Joi.string().valid(
        'cleanliness', 'punctuality', 'driving', 'politeness',
        'communication', 'safety', 'comfort', 'navigation', 'vehicle_condition',
      ),
    ).default([]),
    comment: Joi.string().max(500).optional(),
  }),
};

// ─── Chat ────────────────────────────────────────────────────────────────────

export const sendMessageSchema = {
  body: Joi.object({
    bookingId: Joi.string().hex().length(24).required(),
    content: Joi.string().min(1).max(2000).required(),
    contentType: Joi.string().valid('text', 'image', 'location').default('text'),
  }),
};

// ─── SOS ─────────────────────────────────────────────────────────────────────

export const triggerSOSSchema = {
  body: Joi.object({
    bookingId: Joi.string().hex().length(24).required(),
    location: Joi.object({
      lng: Joi.number().min(-180).max(180).required(),
      lat: Joi.number().min(-90).max(90).required(),
    }).required(),
  }),
};

// ─── Pagination (reusable) ───────────────────────────────────────────────────

export const paginationSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};

// ─── Wallet ───────────────────────────────────────────────────────────────────

export const topUpWalletSchema = {
  body: Joi.object({
    amount: Joi.number().positive().min(50).max(50000).required()
      .messages({
        'number.min': 'Minimum top-up amount is ₹50',
        'number.max': 'Maximum top-up amount is ₹50,000',
      }),
  }),
};

export const confirmTopUpSchema = {
  body: Joi.object({
    razorpayOrderId: Joi.string().trim().required(),
    razorpayPaymentId: Joi.string().trim().required(),
    razorpaySignature: Joi.string().trim().required(),
  }),
};

export const convertCoinsSchema = {
  body: Joi.object({
    coins: Joi.number().integer().min(100).required()
      .messages({
        'number.min': 'Minimum 100 coins required for conversion',
        'number.integer': 'Coins must be a whole number',
      }),
  }),
};

