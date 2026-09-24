import mongoose, { Schema, Document, Types } from 'mongoose';
import { GeoPoint } from '../types';

/**
 * "Tell me when a ride appears on this route" (UC-R02 6a). A rider saves the
 * pickup and drop of a search that found nothing; a newly posted ride that
 * passes both, in that order, triggers a push. An alert for a specific day
 * lasts until that departure; one without a day lasts 30 days.
 */
export interface IRideAlert extends Document {
  _id: Types.ObjectId;
  rider: Types.ObjectId;
  pickup: { location: GeoPoint; address: string };
  dropoff: { location: GeoPoint; address: string };
  /** The time the rider wanted; matching rides leave within ±3 hours of it */
  departureTime?: Date;
  expiresAt: Date;
  notifiedRides: Types.ObjectId[];
  createdAt: Date;
}

const Point = new Schema({ type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], required: true } }, { _id: false });

const RideAlertSchema = new Schema<IRideAlert>(
  {
    rider: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pickup: { location: { type: Point, required: true }, address: { type: String, required: true } },
    dropoff: { location: { type: Point, required: true }, address: { type: String, required: true } },
    departureTime: Date,
    expiresAt: { type: Date, required: true },
    notifiedRides: { type: [Schema.Types.ObjectId], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

RideAlertSchema.index({ 'pickup.location': '2dsphere' });
// MongoDB removes expired alerts on its own
RideAlertSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RideAlert = mongoose.model<IRideAlert>('RideAlert', RideAlertSchema);
