import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * A link a rider sends to people they trust so they can follow the trip
 * without an account (UC-R08). The token is random and unguessable; the
 * link stops working an hour after the ride ends, and every visit is logged.
 */
export interface ITripShare extends Document {
  _id: Types.ObjectId;
  token: string;
  booking: Types.ObjectId;
  createdBy: Types.ObjectId;
  expiresAt: Date;
  views: Array<{ at: Date; ip?: string }>;
  createdAt: Date;
}

const TripShareSchema = new Schema<ITripShare>(
  {
    token: { type: String, required: true, unique: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true, index: true },
    views: { type: [{ at: Date, ip: String, _id: false }], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const TripShare = mongoose.model<ITripShare>('TripShare', TripShareSchema);
