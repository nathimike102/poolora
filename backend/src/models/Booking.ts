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
  /** 'wallet' is paid when the request is made; 'online' is paid through Paynow before the driver can accept */
  paymentMethod?: 'wallet' | 'online';
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
  /** When the rider was reminded to rate (UC-R06 3a), so it happens once */
  ratingReminderSentAt?: Date;
  cancelledBy?: Types.ObjectId;
  cancellationReason?: string;
  cancelledAt?: Date;
  /** What the rider got back on cancellation. */
  refundAmount?: number;
  /** What the rider forfeited for a late cancellation; paid to the driver less the platform fee. */
  cancellationFee?: number;
  /** Optional message from the rider to the driver with the request (UC-R03 step 6) */
  note?: string;
  /** When the driver said they were at this rider's pickup (UC-D04, UC-D07) */
  driverArrivedAt?: Date;
  /** The rider did not come within the waiting time (UC-D07) */
  noShow?: boolean;
  /** The driver moved the departure time after this booking was made; the rider may cancel for a full refund (UC-D08) */
  rideChangedAt?: Date;
  /** In-ride safety check-ins (UC-R05): the open prompt and how many went unanswered */
  safetyCheck?: { promptedAt?: Date; answeredAt?: Date; missed: number };
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
    paymentMethod: { type: String, enum: ['wallet', 'online'] },
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
    ratingReminderSentAt: Date,
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancellationReason: String,
    cancelledAt: Date,
    refundAmount: { type: Number, min: 0 },
    cancellationFee: { type: Number, min: 0 },
    note: { type: String, maxlength: 300 },
    driverArrivedAt: Date,
    noShow: Boolean,
    rideChangedAt: Date,
    safetyCheck: {
      promptedAt: Date,
      answeredAt: Date,
      missed: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    toJSON: { transform(_doc, ret) { delete (ret as Record<string, unknown>).__v; return ret; } },
  },
);

BookingSchema.index({ rider: 1, status: 1 });
BookingSchema.index({ driver: 1, status: 1 });
BookingSchema.index({ status: 1, createdAt: 1 }); // booking sweeper
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
