/**
 * TripPosition.ts
 *
 * Where each phone on a ride was, while the ride was under way: the car
 * (the driver's phone) and each rider from pickup to drop. About one point
 * every 15 seconds per phone.
 *
 * Kept 30 days (decided 30 September 2026), so a safety report, dispute or
 * late SOS has a trail to look at. A MongoDB TTL index deletes them; when an
 * incident is attached to the ride, `expiresAt` is removed and they are kept
 * with it (keepTripTrail).
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import { GeoPoint } from '../types';

export const TRIP_TRAIL_DAYS = 30;

export interface ITripPosition extends Document {
  ride: Types.ObjectId;
  /** The rider's booking, for a rider's phone; absent for the car */
  booking?: Types.ObjectId;
  user: Types.ObjectId;
  /** driver: the driver's phone (the car); vehicle: the car's own GPS tracker */
  role: 'driver' | 'rider' | 'vehicle';
  location: GeoPoint;
  at: Date;
  /** 0 to 1, when the phone reports it */
  battery?: number;
  speed?: number;
  accuracy?: number;
  /** Deleted after this; absent once an incident needs the trail */
  expiresAt?: Date;
}

const TripPositionSchema = new Schema<ITripPosition>(
  {
    ride: { type: Schema.Types.ObjectId, ref: 'Ride', required: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking' },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['driver', 'rider', 'vehicle'], required: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    at: { type: Date, required: true },
    battery: { type: Number, min: 0, max: 1 },
    speed: Number,
    accuracy: Number,
    expiresAt: Date,
  },
  { versionKey: false },
);

TripPositionSchema.index({ ride: 1, user: 1, at: 1 });
TripPositionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TripPosition = mongoose.model<ITripPosition>('TripPosition', TripPositionSchema);
