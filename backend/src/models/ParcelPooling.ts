import mongoose, { Schema, Document, Types } from 'mongoose';
import { BookingStatus, GeoPoint } from '../types';

export interface IParcelPooling extends Document {
  _id: Types.ObjectId;
  ride: Types.ObjectId;
  sender: Types.ObjectId;
  receiver?: Types.ObjectId;
  driver: Types.ObjectId;
  status: BookingStatus;
  parcelWeight: number; // in kg
  parcelDimensions?: {
    length: number; // in cm
    width: number;
    height: number;
  };
  parcelType: 'document' | 'fragile' | 'perishable' | 'general';
  pickupLocation: {
    location: GeoPoint;
    address: string;
    contactPerson: string;
    contactPhone: string;
  };
  deliveryLocation: {
    location: GeoPoint;
    address: string;
    contactPerson: string;
    contactPhone: string;
  };
  estimatedDeliveryTime: Date;
  actualPickupTime?: Date;
  actualDeliveryTime?: Date;
  estimatedCost: number;
  finalCost?: number;
  insuranceValue?: number;
  insuranceCost?: number;
  specialInstructions?: string;
  trackingNumber: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  driverEarnings?: number;
  platformFee?: number;
  cancelledBy?: Types.ObjectId;
  cancellationReason?: string;
  cancelledAt?: Date;
  proof?: {
    signature: string;
    photo?: string;
    otp?: string;
  };
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

const ParcelPoolingSchema = new Schema<IParcelPooling>(
  {
    ride: { type: Schema.Types.ObjectId, ref: 'Ride', required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    receiver: { type: Schema.Types.ObjectId, ref: 'User' },
    driver: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: Object.values(BookingStatus),
      default: BookingStatus.PENDING,
      index: true,
    },
    parcelWeight: { type: Number, required: true, min: 0.1, max: 50 },
    parcelDimensions: {
      length: { type: Number, min: 1 },
      width: { type: Number, min: 1 },
      height: { type: Number, min: 1 },
    },
    parcelType: {
      type: String,
      enum: ['document', 'fragile', 'perishable', 'general'],
      default: 'general',
    },
    pickupLocation: {
      location: { type: GeoPointSchema, required: true },
      address: { type: String, required: true },
      contactPerson: { type: String, required: true },
      contactPhone: { type: String, required: true },
    },
    deliveryLocation: {
      location: { type: GeoPointSchema, required: true },
      address: { type: String, required: true },
      contactPerson: { type: String, required: true },
      contactPhone: { type: String, required: true },
    },
    estimatedDeliveryTime: { type: Date, required: true },
    actualPickupTime: Date,
    actualDeliveryTime: Date,
    estimatedCost: { type: Number, required: true, min: 0 },
    finalCost: { type: Number, min: 0 },
    insuranceValue: { type: Number, min: 0 },
    insuranceCost: { type: Number, min: 0 },
    specialInstructions: String,
    trackingNumber: { type: String, required: true, unique: true, index: true },
    razorpayOrderId: { type: String, sparse: true, unique: true },
    razorpayPaymentId: String,
    driverEarnings: Number,
    platformFee: Number,
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancellationReason: String,
    cancelledAt: Date,
    proof: {
      signature: String,
      photo: String,
      otp: String,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for common queries
ParcelPoolingSchema.index({ sender: 1, createdAt: -1 });
ParcelPoolingSchema.index({ driver: 1, createdAt: -1 });
ParcelPoolingSchema.index({ status: 1, createdAt: -1 });
ParcelPoolingSchema.index({
  'pickupLocation.location': '2dsphere',
  'deliveryLocation.location': '2dsphere',
});

export const ParcelPooling = mongoose.model<IParcelPooling>(
  'ParcelPooling',
  ParcelPoolingSchema,
);