import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  RideStatus,
  RideType,
  VehicleType,
  RecurringPattern,
  GeoPoint,
} from '../types';

// ─── Interface ───────────────────────────────────────────────────────────────

export interface IRide extends Document {
  _id: Types.ObjectId;
  driver: Types.ObjectId;
  rideType: RideType;
  status: RideStatus;
  vehicle: {
    vehicleId: Types.ObjectId;
    vehicleType: VehicleType;
    hasAC: boolean;
    plateNumber: string;
  };
  pickup: {
    location: GeoPoint;
    address: string;
  };
  dropoff: {
    location: GeoPoint;
    address: string;
  };
  waypoints: Array<{
    location: GeoPoint;
    address: string;
    order: number;
  }>;
  departureTime: Date;
  estimatedArrivalTime: Date;
  estimatedDurationMins: number;
  estimatedDistanceKm: number;
  routePolyline: string;
  pricePerSeat: number;
  availableSeats: number;
  totalSeats: number;
  recurring: RecurringPattern;
  preferences: {
    womenOnly: boolean;
    smokingAllowed: boolean;
    petsAllowed: boolean;
    luggageSize: 'none' | 'small' | 'medium' | 'large';
    maxDetourMins: number;
  };
  // Parcel-pool specific
  parcelInfo?: {
    maxWeightKg: number;
    maxDimensions: { length: number; width: number; height: number };
    fragile: boolean;
  };
  cancelledAt?: Date;
  cancellationReason?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const GeoPointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
  { _id: false },
);

const RideSchema = new Schema<IRide>(
  {
    driver: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    rideType: {
      type: String,
      enum: Object.values(RideType),
      default: RideType.CAR_POOL,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(RideStatus),
      default: RideStatus.SCHEDULED,
      index: true,
    },
    vehicle: {
      vehicleId: { type: Schema.Types.ObjectId, required: true },
      vehicleType: { type: String, enum: Object.values(VehicleType), required: true },
      hasAC: { type: Boolean, default: true },
      plateNumber: { type: String, required: true },
    },
    pickup: {
      location: { type: GeoPointSchema, required: true },
      address: { type: String, required: true },
    },
    dropoff: {
      location: { type: GeoPointSchema, required: true },
      address: { type: String, required: true },
    },
    waypoints: [
      {
        location: { type: GeoPointSchema, required: true },
        address: { type: String },
        order: { type: Number, required: true },
      },
    ],
    departureTime: { type: Date, required: true, index: true },
    estimatedArrivalTime: { type: Date, required: true },
    estimatedDurationMins: { type: Number, required: true },
    estimatedDistanceKm: { type: Number, required: true },
    routePolyline: { type: String },
    pricePerSeat: { type: Number, required: true, min: 0 },
    availableSeats: { type: Number, required: true, min: 0 },
    totalSeats: { type: Number, required: true, min: 1 },
    recurring: {
      type: String,
      enum: Object.values(RecurringPattern),
      default: RecurringPattern.NONE,
    },
    preferences: {
      womenOnly: { type: Boolean, default: false },
      smokingAllowed: { type: Boolean, default: false },
      petsAllowed: { type: Boolean, default: false },
      luggageSize: {
        type: String,
        enum: ['none', 'small', 'medium', 'large'],
        default: 'medium',
      },
      maxDetourMins: { type: Number, default: 15 },
    },
    parcelInfo: {
      maxWeightKg: Number,
      maxDimensions: {
        length: Number,
        width: Number,
        height: Number,
      },
      fragile: Boolean,
    },
    cancelledAt: Date,
    cancellationReason: String,
    completedAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete (ret as any).__v;
        return ret;
      },
    },
  },
);

// ─── Geospatial & compound indexes ──────────────────────────────────────────
RideSchema.index({ 'pickup.location': '2dsphere' });
RideSchema.index({ 'dropoff.location': '2dsphere' });
RideSchema.index({ status: 1, departureTime: 1 });
RideSchema.index({ driver: 1, status: 1 });
RideSchema.index({ status: 1, 'pickup.location': '2dsphere', departureTime: 1 });

export const Ride = mongoose.model<IRide>('Ride', RideSchema);
