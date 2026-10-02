import { randomInt } from 'crypto';
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
  /** When the driver accepted the request; starts the free-cancellation window */
  confirmedAt?: Date;
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
  /**
   * A 4-digit code only the rider sees. The driver enters it to confirm the
   * pickup, so the rider knows it is the right car before getting in. Never
   * sent to the driver (select: false). Bookings made before it have none.
   */
  pickupPin?: string;
  /** Wrong codes entered; at PICKUP_PIN_MAX_TRIES only the rider can confirm the pickup */
  pickupPinAttempts?: number;
  /** Who confirmed the pickup: the driver with the code, or the rider in their app */
  pickupConfirmedBy?: 'pin' | 'rider' | 'simulation';
  /** The rider's leg along the route, set on completion (UC-R11) */
  distanceKm?: number;
  /** CO₂ this shared seat saved against going alone, set on completion (UC-R11) */
  co2SavedKg?: number;
  /**
   * The rider's company pays this much of the fare (UC-C01); the rider pays
   * the rest. It is billed to the company only if the trip completes.
   */
  companyShare?: number;
  organisation?: Types.ObjectId;
  /** The month the company's contribution counts against its cap, YYYY-MM in market time */
  companyMonth?: string;
  /** The rider is catching a bus from the drop (UC-R12): when it leaves, and the terminus if the drop is at one */
  connection?: { departsAt: Date; hub?: Types.ObjectId; hubName?: string };
  /** The company bill this booking's share is on (UC-C03); a trip completed after its month was billed goes on the next one */
  companyInvoice?: Types.ObjectId;
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
    confirmedAt: Date,
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
    pickupPin: { type: String, select: false },
    pickupPinAttempts: { type: Number, select: false },
    pickupConfirmedBy: { type: String, enum: ['pin', 'rider', 'simulation'] },
    distanceKm: { type: Number, min: 0 },
    co2SavedKg: { type: Number, min: 0 },
    companyShare: { type: Number, min: 0 },
    organisation: { type: Schema.Types.ObjectId, ref: 'Organisation' },
    companyMonth: { type: String },
    companyInvoice: { type: Schema.Types.ObjectId, ref: 'CompanyInvoice' },
    connection: {
      type: new Schema({ departsAt: { type: Date, required: true }, hub: { type: Schema.Types.ObjectId, ref: 'TransitHub' }, hubName: String }, { _id: false }),
      default: undefined,
    },
  },
  {
    timestamps: true,
    toJSON: { transform(_doc, ret) { delete (ret as Record<string, unknown>).__v; return ret; } },
  },
);

// Every new booking gets its pickup code
BookingSchema.pre('validate', function (next) {
  if (this.isNew && !this.pickupPin) this.pickupPin = String(randomInt(0, 10_000)).padStart(4, '0');
  next();
});

BookingSchema.index({ rider: 1, status: 1 });
// A company's monthly cap per person (UC-C01)
BookingSchema.index({ rider: 1, organisation: 1, companyMonth: 1 }, { sparse: true });
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
