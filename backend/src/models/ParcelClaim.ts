import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * A claim for a damaged or lost parcel (UC-P05). Insured parcels are covered
 * up to their declared value; others up to the delivery charge. An admin
 * decides (after the insurer, when one is connected) and approved claims are
 * paid into the claimant's wallet.
 */
export interface IParcelClaim extends Document {
  _id: Types.ObjectId;
  parcel: Types.ObjectId;
  claimant: Types.ObjectId;
  kind: 'damaged' | 'lost';
  description: string;
  amountClaimed: number;
  /** The most this claim can pay, fixed when it was filed */
  coverLimit: number;
  insured: boolean;
  photos: Types.ObjectId[];
  status: 'submitted' | 'with_insurer' | 'approved' | 'rejected';
  insurerReference?: string;
  payout?: number;
  decidedBy?: Types.ObjectId;
  decidedAt?: Date;
  decisionNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ParcelClaimSchema = new Schema<IParcelClaim>(
  {
    parcel: { type: Schema.Types.ObjectId, ref: 'ParcelPooling', required: true, index: true },
    claimant: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: ['damaged', 'lost'], required: true },
    description: { type: String, required: true, maxlength: 2000 },
    amountClaimed: { type: Number, required: true, min: 1 },
    coverLimit: { type: Number, required: true },
    insured: { type: Boolean, default: false },
    photos: [{ type: Schema.Types.ObjectId, ref: 'ParcelPhoto' }],
    status: { type: String, enum: ['submitted', 'with_insurer', 'approved', 'rejected'], default: 'submitted', index: true },
    insurerReference: String,
    payout: Number,
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decidedAt: Date,
    decisionNote: String,
  },
  { timestamps: true },
);

export const ParcelClaim = mongoose.model<IParcelClaim>('ParcelClaim', ParcelClaimSchema);
