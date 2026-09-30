import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  UserCapability,
  KYCStatus,
  VehicleType,
  IVehicle,
  IKYCData,
  IEmergencyContact,
  IUserStats,
  GeoPoint,
  FraudLevel,
} from '../types';

// ─── Interface ───────────────────────────────────────────────────────────────

export interface IUser extends Document {
  _id: Types.ObjectId;
  firebaseUid?: string;
  phone: string;
  email?: string;
  name: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other';
  profilePhotoUrl?: string;
  capabilities: UserCapability[];
  kyc: IKYCData;
  vehicles: IVehicle[];
  emergencyContacts: IEmergencyContact[];
  stats: IUserStats;
  fcmTokens: string[];
  lastKnownLocation?: GeoPoint;
  isSuspended: boolean;
  suspendedUntil?: Date;
  fraudLevel: FraudLevel;
  /** What the last automatic fraud check found, for the admin review (UC-AI02) */
  fraudFlags?: string[];
  fraudFlaggedAt?: Date;
  /** An admin's decision on the last flag; absent while it waits for review */
  fraudReview?: { decision: 'cleared' | 'confirmed'; by: Types.ObjectId; at: Date; note: string };
  blockReason?: string;
  isBlocked: boolean;
  /** Why the account is suspended, shown to admins */
  suspensionReason?: string;
  /** Warnings from dispute decisions (UC-A04) */
  warnings: number;
  /** A block waits for a second admin to approve it (UC-A05 3b) */
  pendingBlock?: { requestedBy: Types.ObjectId; reason: string; requestedAt: Date };
  /** Set on a duplicate account after it was merged into this one (UC-A05) */
  mergedInto?: Types.ObjectId;
  /** Duplicate accounts merged into this one, with the phone numbers they used */
  mergedFrom?: Array<{ user: Types.ObjectId; phone: string; at: Date }>;
  otpAttempts: number;
  otpLastAttemptAt?: Date;
  isActive: boolean;
  /** Set when the user closed their own account; personal data is removed then */
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Sub-schemas ─────────────────────────────────────────────────────────────

const VehicleSchema = new Schema<IVehicle>(
  {
    make: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    year: { type: Number, required: true },
    color: { type: String, required: true, trim: true },
    plateNumber: { type: String, required: true, uppercase: true, trim: true },
    vehicleType: { type: String, enum: Object.values(VehicleType), required: true },
    hasAC: { type: Boolean, default: true },
    registrationDocUrl: { type: String, required: true },
    insuranceDocUrl: { type: String, required: true },
    photos: [{ type: String }],
  },
  { _id: true },
);

const KYCSchema = new Schema<IKYCData>(
  {
    status: { type: String, enum: Object.values(KYCStatus), default: KYCStatus.NONE },
    drivingLicenseUrl: String,
    licenseNumber: String,
    submittedAt: Date,
    reviewedAt: Date,
    rejectionReason: String,
    autoChecks: { type: [{ _id: false, check: String, result: { type: String, enum: ['pass', 'warn', 'fail'] }, detail: String }], default: undefined },
    autoCheckedAt: Date,
    backgroundCheck: {
      type: new Schema({ status: { type: String, enum: ['pending', 'clear', 'consider', 'error'] }, reference: String, summary: String, checkedAt: Date }, { _id: false }),
      default: undefined,
    },
  },
  { _id: false },
);

const EmergencyContactSchema = new Schema<IEmergencyContact>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    relation: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    primary: { type: Boolean, default: false },
    notifyOnSos: { type: Boolean, default: true },
    verifiedAt: { type: Date },
    // Never sent to clients; the link in the text carries the token itself
    verifyTokenHash: { type: String, select: false },
    verifySentAt: { type: Date },
  },
);

const UserStatsSchema = new Schema<IUserStats>(
  {
    totalRidesAsDriver: { type: Number, default: 0 },
    totalRidesAsRider: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    avgRatingAsDriver: { type: Number, default: 0 },
    avgRatingAsRider: { type: Number, default: 0 },
    totalRatingsAsDriver: { type: Number, default: 0 },
    totalRatingsAsRider: { type: Number, default: 0 },
    /** From trip members after a group trip (UC-T02) */
    avgRatingAsOrganizer: { type: Number, default: 0 },
    totalRatingsAsOrganizer: { type: Number, default: 0 },
    cancellationRate: { type: Number, default: 0 },
    acceptanceRate: { type: Number, default: 1 },
  },
  { _id: false },
);

// ─── Main Schema ─────────────────────────────────────────────────────────────

const GeoPointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
  { _id: false },
);

const UserSchema = new Schema<IUser>(
  {
    firebaseUid: {
      type: String,
      sparse: true,
      unique: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      sparse: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    dateOfBirth: Date,
    gender: { type: String, enum: ['male', 'female', 'other'] },
    profilePhotoUrl: String,
    capabilities: {
      type: [{ type: String, enum: Object.values(UserCapability) }],
      default: [UserCapability.RIDER],
    },
    kyc: { type: KYCSchema, default: () => ({ status: KYCStatus.NONE }) },
    vehicles: { type: [VehicleSchema], default: [] },
    emergencyContacts: { type: [EmergencyContactSchema], default: [] },
    stats: { type: UserStatsSchema, default: () => ({}) },
    fcmTokens: { type: [String], default: [] },
    lastKnownLocation: { type: GeoPointSchema, index: '2dsphere' },
    isSuspended: { type: Boolean, default: false },
    suspendedUntil: Date,
    fraudLevel: { type: String, enum: Object.values(FraudLevel), default: FraudLevel.CLEAR },
    fraudFlags: { type: [String], default: undefined },
    fraudFlaggedAt: { type: Date },
    fraudReview: {
      type: new Schema(
        { decision: { type: String, enum: ['cleared', 'confirmed'] }, by: { type: Schema.Types.ObjectId, ref: 'User' }, at: Date, note: String },
        { _id: false },
      ),
      default: undefined,
    },
    blockReason: String,
    isBlocked: { type: Boolean, default: false },
    otpAttempts: { type: Number, default: 0 },
    otpLastAttemptAt: Date,
    suspensionReason: String,
    warnings: { type: Number, default: 0 },
    pendingBlock: {
      requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      reason: String,
      requestedAt: Date,
    },
    mergedInto: { type: Schema.Types.ObjectId, ref: 'User' },
    mergedFrom: {
      type: [{ _id: false, user: { type: Schema.Types.ObjectId, ref: 'User' }, phone: String, at: Date }],
      default: undefined,
    },
    isActive: { type: Boolean, default: true },
    closedAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete (ret as Record<string, unknown>).__v;
        return ret;
      },
    },
  },
);

// ─── Compound indexes ────────────────────────────────────────────────────────
UserSchema.index({ phone: 1, isActive: 1 });
UserSchema.index({ 'kyc.status': 1 });
UserSchema.index({ capabilities: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);
