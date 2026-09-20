import mongoose, { Schema, Document } from 'mongoose';

export interface IOtpChallenge extends Document {
  phone: string;
  otpHash: string;
  expiresAt: Date;
  /** Wrong codes entered against the code currently on issue. */
  attempts: number;
  /** Wrong codes in the recent past, which set how long the next wait is. */
  failures: number;
  /** Nothing is accepted before this moment. Not an account lock. */
  retryAfter?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OtpChallengeSchema = new Schema<IOtpChallenge>(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
    attempts: {
      type: Number,
      default: 0,
    },
    failures: {
      type: Number,
      default: 0,
    },
    retryAfter: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

OtpChallengeSchema.index({ phone: 1, retryAfter: 1 });

export const OtpChallenge = mongoose.model<IOtpChallenge>('OtpChallenge', OtpChallengeSchema);
