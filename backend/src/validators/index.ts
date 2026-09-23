import Joi from 'joi';
import { VehicleType, RideType, RecurringPattern, SOSCheckInStatus } from '../types';

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

/** KYC documents are uploaded to S3 first; only s3:// references are accepted. */
const kycDocUri = Joi.string().uri({ scheme: ['s3'] }).max(512);

export const submitKycSchema = {
  body: Joi.object({
    licenseNumber: Joi.string().trim().uppercase().min(8).max(20).required(),
    drivingLicenseUrl: kycDocUri.required(),
    vehicle: Joi.object({
      make: Joi.string().required().trim().max(50),
      model: Joi.string().required().trim().max(50),
      year: Joi.number().integer().min(2000).max(new Date().getFullYear() + 1).required(),
      color: Joi.string().required().trim().max(30),
      plateNumber: Joi.string().required().uppercase().trim().max(15),
      vehicleType: Joi.string().valid(...Object.values(VehicleType)).required(),
      hasAC: Joi.boolean().default(true),
      registrationDocUrl: kycDocUri.required(),
      insuranceDocUrl: kycDocUri.required(),
      photos: Joi.array().items(kycDocUri).min(1).max(4).required(),
    }).required(),
  }),
};

export const presignKycUploadSchema = {
  body: Joi.object({
    purpose: Joi.string().valid('licence', 'registration', 'insurance', 'vehicle-photo').required(),
    contentType: Joi.string().valid('image/jpeg', 'image/png', 'application/pdf').required(),
  }),
};

const kycReviewParams = Joi.object({
  userId: Joi.string().hex().length(24).required(),
});

export const kycReviewParamsSchema = {
  params: kycReviewParams,
};

export const rejectKycSchema = {
  params: kycReviewParams,
  body: Joi.object({
    reason: Joi.string().trim().min(5).max(500).required(),
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
    useWallet: Joi.boolean().default(false),
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

const objectIdParams = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

export const sosLocationSchema = {
  params: objectIdParams,
  body: Joi.object({
    location: Joi.object({
      lng: Joi.number().min(-180).max(180).required(),
      lat: Joi.number().min(-90).max(90).required(),
    }).required(),
  }),
};

export const sosEvidenceSchema = {
  params: objectIdParams,
  body: Joi.object({
    type: Joi.string().valid('audio', 'screenshot').required(),
    url: Joi.string().uri({ scheme: ['https'] }).max(2048).required(),
  }),
};

export const emergencyContactsSchema = {
  body: Joi.object({
    contacts: Joi.array().items(
      Joi.object({
        name: Joi.string().trim().min(1).max(100).required(),
        phone: Joi.string().replace(/[\s()-]/g, '').pattern(/^\+[1-9]\d{7,14}$/).required(),
        relation: Joi.string().trim().max(50).required(),
      }),
    ).max(5).required(),
  }),
};

export const idParamSchema = {
  params: objectIdParams,
};

export const sosCheckInSchema = {
  params: objectIdParams,
  body: Joi.object({
    status: Joi.string().valid(...Object.values(SOSCheckInStatus)).required(),
    notes: Joi.string().max(1000).optional(),
    location: Joi.object({
      lng: Joi.number().min(-180).max(180).required(),
      lat: Joi.number().min(-90).max(90).required(),
    }).optional(),
  }),
};

// ─── User ────────────────────────────────────────────────────────────────────

export const updateMeSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(100),
    email: Joi.string().trim().lowercase().email().max(254).allow('', null),
    dateOfBirth: Joi.date().iso().max('now'),
  }).min(1),
};

// ─── Maps ────────────────────────────────────────────────────────────────────

export const geocodeSchema = {
  query: Joi.object({
    address: Joi.string().trim().min(3).max(300).required(),
  }),
};

export const reverseGeocodeSchema = {
  query: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
  }),
};

export const autocompleteSchema = {
  query: Joi.object({
    input: Joi.string().trim().min(2).max(200).required(),
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

// ─── Parcel Pooling ──────────────────────────────────────────────────────────

export const createParcelValidator = {
  body: Joi.object({
    rideId: Joi.string().hex().length(24).required(),
    parcelWeight: Joi.number().positive().min(0.1).max(50).required()
      .messages({
        'number.min': 'Parcel weight must be at least 0.1 kg',
        'number.max': 'Parcel weight cannot exceed 50 kg',
      }),
    parcelType: Joi.string().valid('document', 'fragile', 'perishable', 'general').required(),
    parcelDimensions: Joi.object({
      length: Joi.number().positive().required(),
      width: Joi.number().positive().required(),
      height: Joi.number().positive().required(),
    }).optional(),
    pickupLocation: Joi.object({
      lng: Joi.number().min(-180).max(180).required(),
      lat: Joi.number().min(-90).max(90).required(),
      address: Joi.string().min(5).max(500).required(),
      contactPerson: Joi.string().min(2).max(100).required(),
      contactPhone: Joi.string().pattern(/^\+[1-9]\d{7,14}$/).required(),
    }).required(),
    deliveryLocation: Joi.object({
      lng: Joi.number().min(-180).max(180).required(),
      lat: Joi.number().min(-90).max(90).required(),
      address: Joi.string().min(5).max(500).required(),
      contactPerson: Joi.string().min(2).max(100).required(),
      contactPhone: Joi.string().pattern(/^\+[1-9]\d{7,14}$/).required(),
    }).required(),
    estimatedDeliveryTime: Joi.date().iso().required().min('now'),
    insuranceValue: Joi.number().min(0).optional(),
    specialInstructions: Joi.string().max(500).optional(),
    receiverId: Joi.string().hex().length(24).optional(),
  }),
};

export const acceptParcelValidator = {
  params: Joi.object({
    id: Joi.string().hex().length(24).required(),
  }),
};

export const deliverParcelValidator = {
  params: acceptParcelValidator.params,
  body: Joi.object({
    proof: Joi.object({
      signature: Joi.string().max(200_000).required(),
      photo: Joi.string().uri({ scheme: ['https'] }).max(2048).optional(),
      otp: Joi.string().pattern(/^\d{6}$/).required()
        .messages({ 'string.pattern.base': 'Delivery code must be 6 digits' }),
    }).required(),
  }),
};

export const cancelParcelValidator = {
  params: acceptParcelValidator.params,
  body: Joi.object({
    reason: Joi.string().trim().max(500).default('Cancelled by sender'),
  }),
};

export const trackParcelValidator = {
  params: Joi.object({
    trackingNumber: Joi.string().pattern(/^TRK-[A-Z0-9]+-[A-F0-9]{8}$/).required(),
  }),
};

export const listParcelsValidator = {
  query: Joi.object({
    role: Joi.string().valid('sender', 'driver', 'receiver').default('sender'),
    skip: Joi.number().integer().min(0).default(0),
    limit: Joi.number().integer().min(1).max(50).default(20),
  }),
};


