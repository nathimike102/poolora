import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * Merging a duplicate account into the one the person keeps (UC-A05). One
 * admin asks, a second approves; the merge then moves history, money and
 * coins. `moved` records what went across. See services/AccountMergeService.ts.
 */
export interface IAccountMerge extends Document {
  _id: Types.ObjectId;
  /** The duplicate, closed by the merge */
  source: Types.ObjectId;
  /** The account the person keeps */
  target: Types.ObjectId;
  reason: string;
  requestedBy: Types.ObjectId;
  status: 'pending' | 'running' | 'completed' | 'rejected';
  decidedBy?: Types.ObjectId;
  decidedAt?: Date;
  decisionNote?: string;
  moved?: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

const AccountMergeSchema = new Schema<IAccountMerge>(
  {
    source: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    target: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reason: { type: String, required: true, maxlength: 1000 },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'running', 'completed', 'rejected'], default: 'pending', index: true },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decidedAt: Date,
    decisionNote: String,
    moved: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const AccountMerge = mongoose.model<IAccountMerge>('AccountMerge', AccountMergeSchema);
