import mongoose, { Schema, Document, Types } from 'mongoose';
import { BookingStatus, GeoPoint } from '../types';

export interface IBooking extends Document {
  _id: Types.ObjectId;
  ride: Types.ObjectId;
  rider: Types.ObjectId;
  driver: Types.ObjectId;
  status: BookingStatus;
  seatsBooked: number;
  pickup: {
    location: GeoPoint;
    address: string;
  };
  dropoff: {
    location: GeoPoint;
    address: string;
  };
  estimatedFare: number;
  finalFare?: number;
  matchScore: number;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  driverEarnings?: number;
  platformFee?: number;
  settlementStatus: 'pending' | 'processing' | 'settled';
  settlementDate?: Date;
  riderConfirmedPickup: boolean;
  riderConfirmedDropoff: boolean;
  driverConfirmedPickup: boolean;
  driverConfirmedDropoff: boolean;
  actualPickupTime?: Date;
  actualDropoffTime?: Date;
  cancelledBy?: Types.ObjectId;
  cancellationReason?: string;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GeoPointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
  { _id: false },
);

const BookingSchema = new Schema<IBooking>(
  {
    ride: { type: Schema.Types.ObjectId, ref: 'Ride', required: true, index: true },
    rider: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    driver: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: Object.values(BookingStatus),
      default: BookingStatus.PENDING,
      index: true,
    },
    seatsBooked: { type: Number, required: true, min: 1 },
    pickup: {
      location: { type: GeoPointSchema, required: true },
      address: { type: String, required: true },
    },
    dropoff: {
      location: { type: GeoPointSchema, required: true },
      address: { type: String, required: true },
    },
    estimatedFare: { type: Number, required: true, min: 0 },
    finalFare: { type: Number, min: 0 },
    matchScore: { type: Number, default: 0, min: 0, max: 100 },
    razorpayOrderId: { type: String, sparse: true, unique: true },
    razorpayPaymentId: String,
    driverEarnings: Number,
    platformFee: Number,
    settlementStatus: {
      type: String,
      enum: ['pending', 'processing', 'settled'],
      default: 'pending',
    },
    settlementDate: Date,
    riderConfirmedPickup: { type: Boolean, default: false },
    riderConfirmedDropoff: { type: Boolean, default: false },
    driverConfirmedPickup: { type: Boolean, default: false },
    driverConfirmedDropoff: { type: Boolean, default: false },
    actualPickupTime: Date,
    actualDropoffTime: Date,
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancellationReason: String,
    cancelledAt: Date,
  },
  {
    timestamps: true,
    toJSON: { transform(_doc, ret) { delete (ret as any).__v; return ret; } },
  },
);

BookingSchema.index({ rider: 1, status: 1 });
BookingSchema.index({ driver: 1, status: 1 });
BookingSchema.index(
  { ride: 1, rider: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['pending', 'confirmed'] },
    },
  },
);

export const Booking = mongoose.model<IBooking>('Booking', BookingSchema);
