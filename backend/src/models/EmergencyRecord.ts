import mongoose, { Schema, Document, Types } from 'mongoose';
import { SOSStatus, SOSRiskLevel, SOSMonitoringState, GeoPoint } from '../types';

export type SOSLocationSource = 'device' | 'ride' | 'pickup';
/** Who or what the person says the danger is (optional, after raising) */
export type SOSThreat = 'driver' | 'passenger' | 'outside' | 'medical' | 'accident' | 'other';
export type SOSContactsState = 'pending' | 'sending' | 'sent' | 'unavailable' | 'none' | 'cancelled';

export interface IEmergencyRecord extends Document {
  _id: Types.ObjectId;
  booking: Types.ObjectId;
  ride: Types.ObjectId;
  triggeredBy: Types.ObjectId;
  status: SOSStatus;
  /** Set while the SOS is open, to "<booking>:<user>", so one person has one open SOS per booking */
  openKey?: string;
  triggerLocation: GeoPoint;
  /** Where the first position came from: the phone, or the ride when the phone had none */
  locationSource: SOSLocationSource;
  locationHistory: Array<{
    location: GeoPoint;
    timestamp: Date;
    /** 0 to 1, when the phone reports it */
    battery?: number;
  }>;
  /** The phone's battery at its last position: low means it probably ran out, high that it was switched off */
  lastBattery?: number;
  threat?: SOSThreat;
  /** How it was raised: the app, a missed check-in, or the car's panic button */
  raisedVia?: 'app' | 'check-in' | 'tracker';
  audioRecordingUrls: string[];
  screenshotUrls: string[];
  /**
   * Live video during the SOS (UC-X04). The safety team can ask for it, and
   * the person can turn the camera on themselves. Only the phone sends; the
   * team watches without making any sound on it.
   */
  video?: {
    room: string;
    /** LiveKit's id for this video's room, so events about an earlier room are ignored */
    roomSid?: string;
    requestedAt?: Date;
    requestedBy?: Types.ObjectId;
    /** The phone's camera came on (the latest time, if turned on again) */
    startedAt?: Date;
    endedAt?: Date;
    /** Decided when the camera comes on, so the person is told before it does */
    recording: boolean;
    egressId?: string;
  };
  videoRecordingUrls: string[];
  emergencyContactsNotified: Array<{
    name: string;
    phone: string;
    notifiedAt: Date;
    method: 'sms' | 'call';
  }>;
  /**
   * Emergency contacts are texted after a short window in which the user can
   * cancel an accidental SOS (UC-R07 3a); the safety team is told at once.
   */
  contactsState: SOSContactsState;
  contactsDueAt?: Date;
  adminNotifiedAt?: Date;
  adminAssignee?: Types.ObjectId;
  /** Admins were last paged at this time; repeated while nobody takes the SOS */
  lastPagedAt?: Date;
  pageCount: number;
  /** The user said they are safe. The safety team still confirms and closes the SOS */
  userSafeAt?: Date;
  /** The phone stopped sending its position */
  lostContactAt?: Date;
  /** The user cancelled inside the window, before anyone outside Poolora was told */
  cancelledAt?: Date;
  liveTrackingUrl: string;
  riskLevel: SOSRiskLevel;
  monitoringState: SOSMonitoringState;
  checkInIntervalSeconds: number;
  lastCheckInAt?: Date;
  nextCheckInAt?: Date;
  missedCheckIns: number;
  escalatedAt?: Date;
  escalationReason?: string;
  policeNotifiedAt?: Date;
  // Retention: when sensitive SOS data should be purged
  retentionExpiresAt?: Date;
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
    openKey: { type: String },
    triggerLocation: { type: GeoPointSchema, required: true },
    locationSource: { type: String, enum: ['device', 'ride', 'pickup'], default: 'device' },
    locationHistory: [
      {
        location: { type: GeoPointSchema, required: true },
        timestamp: { type: Date, required: true },
        battery: { type: Number, min: 0, max: 1 },
      },
    ],
    lastBattery: { type: Number, min: 0, max: 1 },
    threat: { type: String, enum: ['driver', 'passenger', 'outside', 'medical', 'accident', 'other'] },
    raisedVia: { type: String, enum: ['app', 'check-in', 'tracker'] },
    audioRecordingUrls: [String],
    screenshotUrls: [String],
    video: {
      type: new Schema(
        {
          room: { type: String, required: true },
          roomSid: String,
          requestedAt: Date,
          requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
          startedAt: Date,
          endedAt: Date,
          recording: { type: Boolean, default: false },
          egressId: String,
        },
        { _id: false },
      ),
      default: undefined,
    },
    videoRecordingUrls: [String],
    emergencyContactsNotified: [
      {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        notifiedAt: { type: Date, required: true },
        method: { type: String, enum: ['sms', 'call'], required: true },
      },
    ],
    contactsState: { type: String, enum: ['pending', 'sending', 'sent', 'unavailable', 'none', 'cancelled'], default: 'none' },
    contactsDueAt: Date,
    adminNotifiedAt: Date,
    adminAssignee: { type: Schema.Types.ObjectId, ref: 'User' },
    lastPagedAt: Date,
    pageCount: { type: Number, default: 0 },
    userSafeAt: Date,
    lostContactAt: Date,
    cancelledAt: Date,
    liveTrackingUrl: { type: String, required: true },
    riskLevel: {
      type: String,
      enum: Object.values(SOSRiskLevel),
      default: SOSRiskLevel.LOW,
      index: true,
    },
    monitoringState: {
      type: String,
      enum: Object.values(SOSMonitoringState),
      default: SOSMonitoringState.ACTIVE,
      index: true,
    },
    checkInIntervalSeconds: { type: Number, default: 120 },
    lastCheckInAt: Date,
    nextCheckInAt: { type: Date, index: true },
    missedCheckIns: { type: Number, default: 0 },
    escalatedAt: Date,
    escalationReason: String,
    policeNotifiedAt: Date,
    // Retention: when sensitive SOS data should be purged
    retentionExpiresAt: { type: Date, index: true },
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
    toJSON: { transform(_doc, ret) { delete (ret as Record<string, unknown>).__v; return ret; } },
  },
);

EmergencyRecordSchema.index({ 'triggerLocation': '2dsphere' });
EmergencyRecordSchema.index({ status: 1, createdAt: -1 });
EmergencyRecordSchema.index({ status: 1, nextCheckInAt: 1 });
EmergencyRecordSchema.index({ openKey: 1 }, { unique: true, sparse: true });
EmergencyRecordSchema.index({ contactsState: 1, contactsDueAt: 1 });

export const EmergencyRecord = mongoose.model<IEmergencyRecord>(
  'EmergencyRecord',
  EmergencyRecordSchema,
);
