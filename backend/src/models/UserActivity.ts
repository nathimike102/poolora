import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * One row per user per local day they used the app while signed in. It is all
 * the Analytics page needs for daily, weekly and monthly actives and for
 * retention, and holds nothing else: no location, device or screen.
 */
export interface IUserActivity extends Document {
  user: Types.ObjectId;
  /** Local calendar day, YYYY-MM-DD */
  day: string;
  createdAt: Date;
}

const UserActivitySchema = new Schema<IUserActivity>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    day: { type: String, required: true },
    // Kept about 13 months, enough for year-on-year retention
    createdAt: { type: Date, default: Date.now, index: { expireAfterSeconds: 400 * 86_400 } },
  },
  { versionKey: false },
);

UserActivitySchema.index({ user: 1, day: 1 }, { unique: true });
UserActivitySchema.index({ day: 1 });

export const UserActivity = mongoose.model<IUserActivity>('UserActivity', UserActivitySchema);
