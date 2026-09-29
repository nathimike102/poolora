import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * An admin's alert rule (UC-A02, UC-A06): when a measure crosses a
 * threshold, tell chosen admins on the dashboard, by email and by SMS. A
 * rule fires once, then stays quiet for its cooldown. See
 * services/AlertRuleService.ts for the measures.
 */
export interface IAlertRule extends Document {
  _id: Types.ObjectId;
  name: string;
  metric: string;
  comparator: 'above' | 'below';
  threshold: number;
  channels: { email: boolean; sms: boolean };
  /** Admins told; each needs an email or phone for those channels */
  recipients: Types.ObjectId[];
  cooldownMins: number;
  active: boolean;
  createdBy: Types.ObjectId;
  lastValue?: number;
  lastCheckedAt?: Date;
  lastFiredAt?: Date;
  /** The latest firings, newest first */
  history: Array<{ at: Date; value: number; sent: { email: number; sms: number } }>;
  createdAt: Date;
  updatedAt: Date;
}

const AlertRuleSchema = new Schema<IAlertRule>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    metric: { type: String, required: true },
    comparator: { type: String, enum: ['above', 'below'], required: true },
    threshold: { type: Number, required: true },
    channels: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
    },
    recipients: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    cooldownMins: { type: Number, default: 60, min: 5, max: 1440 },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastValue: Number,
    lastCheckedAt: Date,
    lastFiredAt: Date,
    history: {
      type: [{ _id: false, at: Date, value: Number, sent: { email: Number, sms: Number } }],
      default: [],
    },
  },
  { timestamps: true },
);

export const AlertRule = mongoose.model<IAlertRule>('AlertRule', AlertRuleSchema);
