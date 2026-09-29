import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * A masked call between a rider and a driver (UC-D06), placed through the
 * platform's Twilio number so neither sees the other's phone. When recording
 * is on, the recording is kept for safety reviews (UC-A03) and only admins
 * can play it.
 */
export interface ICallLog extends Document {
  _id: Types.ObjectId;
  booking: Types.ObjectId;
  caller: Types.ObjectId;
  callee: Types.ObjectId;
  twilioCallSid?: string;
  status: 'initiated' | 'ringing' | 'in-progress' | 'completed' | 'busy' | 'no-answer' | 'failed' | 'canceled';
  durationSec?: number;
  recorded: boolean;
  recordingSid?: string;
  recordingUrl?: string;
  recordingDurationSec?: number;
  createdAt: Date;
  updatedAt: Date;
}

const CallLogSchema = new Schema<ICallLog>(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    caller: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    callee: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    twilioCallSid: { type: String, index: true },
    status: { type: String, default: 'initiated' },
    durationSec: Number,
    recorded: { type: Boolean, default: false },
    recordingSid: String,
    recordingUrl: String,
    recordingDurationSec: Number,
  },
  { timestamps: true },
);

export const CallLog = mongoose.model<ICallLog>('CallLog', CallLogSchema);
