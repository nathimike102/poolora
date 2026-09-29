import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * A change to critical platform settings (fees and refunds) waiting for a
 * second admin (UC-A07). It applies only when another admin approves it, and
 * lapses after 24 hours. See services/SettingsService.ts.
 */
export interface ISettingsChangeRequest extends Document {
  _id: Types.ObjectId;
  changes: Record<string, unknown>;
  reason: string;
  requestedBy: Types.ObjectId;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  decidedBy?: Types.ObjectId;
  decidedAt?: Date;
  decisionNote?: string;
  expiresAt: Date;
  createdAt: Date;
}

const SettingsChangeRequestSchema = new Schema<ISettingsChangeRequest>(
  {
    changes: { type: Schema.Types.Mixed, required: true },
    reason: { type: String, required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'expired'], default: 'pending', index: true },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decidedAt: Date,
    decisionNote: String,
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false },
);

export const SettingsChangeRequest = mongoose.model<ISettingsChangeRequest>('SettingsChangeRequest', SettingsChangeRequestSchema);
