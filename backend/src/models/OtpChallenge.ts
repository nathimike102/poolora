import mongoose, { Schema, Document } from 'mongoose';

export interface IOtpChallenge extends Document {
  phone: string;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  suspendedUntil?: Date;
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
    suspendedUntil: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

OtpChallengeSchema.index({ phone: 1, suspendedUntil: 1 });

export const OtpChallenge = mongoose.model<IOtpChallenge>('OtpChallenge', OtpChallengeSchema);
