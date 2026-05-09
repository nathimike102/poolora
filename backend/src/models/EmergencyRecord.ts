import mongoose, { Schema, Document, Types } from 'mongoose';
import { SOSStatus, GeoPoint } from '../types';

export interface IEmergencyRecord extends Document {
  _id: Types.ObjectId;
  booking: Types.ObjectId;
  ride: Types.ObjectId;
  triggeredBy: Types.ObjectId;
  status: SOSStatus;
  triggerLocation: GeoPoint;
  locationHistory: Array<{
    location: GeoPoint;
    timestamp: Date;
  }>;
  audioRecordingUrls: string[];
  screenshotUrls: string[];
  emergencyContactsNotified: Array<{
    name: string;
    phone: string;
    notifiedAt: Date;
    method: 'sms' | 'call';
  }>;
  adminNotifiedAt?: Date;
  adminAssignee?: Types.ObjectId;
  liveTrackingUrl: string;
  timeline: Array<{
    event: string;
    timestamp: Date;
    details?: string;
  }>;
  resolvedAt?: Date;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GeoPointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
  { _id: false },
);

const EmergencyRecordSchema = new Schema<IEmergencyRecord>(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    ride: { type: Schema.Types.ObjectId, ref: 'Ride', required: true },
    triggeredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: Object.values(SOSStatus),
      default: SOSStatus.TRIGGERED,
      index: true,
    },
    triggerLocation: { type: GeoPointSchema, required: true },
    locationHistory: [
      {
        location: { type: GeoPointSchema, required: true },
        timestamp: { type: Date, required: true },
      },
    ],
    audioRecordingUrls: [String],
    screenshotUrls: [String],
    emergencyContactsNotified: [
      {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        notifiedAt: { type: Date, required: true },
        method: { type: String, enum: ['sms', 'call'], required: true },
      },
    ],
    adminNotifiedAt: Date,
    adminAssignee: { type: Schema.Types.ObjectId, ref: 'User' },
    liveTrackingUrl: { type: String, required: true },
    timeline: [
      {
        event: { type: String, required: true },
        timestamp: { type: Date, required: true },
        details: String,
      },
    ],
    resolvedAt: Date,
    resolutionNotes: String,
  },
  {
    timestamps: true,
    toJSON: { transform(_doc, ret) { delete (ret as any).__v; return ret; } },
  },
);

EmergencyRecordSchema.index({ 'triggerLocation': '2dsphere' });
EmergencyRecordSchema.index({ status: 1, createdAt: -1 });

export const EmergencyRecord = mongoose.model<IEmergencyRecord>(
  'EmergencyRecord',
  EmergencyRecordSchema,
);
