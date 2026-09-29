import mongoose, { Schema, Document, Types } from 'mongoose';

export const DISPUTE_CATEGORIES = ['payment', 'cancellation', 'behavior', 'route', 'quality'] as const;
export type DisputeCategory = (typeof DISPUTE_CATEGORIES)[number];

export const DISPUTE_OUTCOMES = ['rider', 'driver', 'both', 'dismissed'] as const;
export type DisputeOutcome = (typeof DISPUTE_OUTCOMES)[number];

/**
 * A disagreement between a booking's rider and driver, raised by either and
 * decided by an admin (UC-A04).
 */
export interface IDispute extends Document {
  _id: Types.ObjectId;
  booking: Types.ObjectId;
  ride: Types.ObjectId;
  raisedBy: Types.ObjectId;
  against: Types.ObjectId;
  category: DisputeCategory;
  description: string;
  evidenceUrls: string[];
  status: 'open' | 'in_review' | 'resolved';
  assignedTo?: Types.ObjectId;
  decision?: {
    outcome: DisputeOutcome;
    /** Returned to the rider, in US dollars */
    refundAmount: number;
    /** What the refund did; 'failed' or 'none' means it needs a manual refund */
    refundStatus?: string;
    /** Paid to the driver's wallet, in US dollars */
    driverCompensation: number;
    warned: Types.ObjectId[];
    suspendedDays?: number | null;
    suspended?: Types.ObjectId[];
    justification: string;
    decidedBy: Types.ObjectId;
    decidedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const DisputeSchema = new Schema<IDispute>(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    ride: { type: Schema.Types.ObjectId, ref: 'Ride', required: true },
    raisedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    against: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: String, enum: DISPUTE_CATEGORIES, required: true },
    description: { type: String, required: true, maxlength: 2000 },
    evidenceUrls: { type: [String], default: [] },
    status: { type: String, enum: ['open', 'in_review', 'resolved'], default: 'open', index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    decision: {
      outcome: { type: String, enum: DISPUTE_OUTCOMES },
      refundAmount: { type: Number, min: 0 },
      refundStatus: String,
      driverCompensation: { type: Number, min: 0 },
      warned: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      suspendedDays: Number,
      suspended: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      justification: String,
      decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      decidedAt: Date,
    },
  },
  { timestamps: true },
);

DisputeSchema.index({ status: 1, createdAt: -1 });

export const Dispute = mongoose.model<IDispute>('Dispute', DisputeSchema);
