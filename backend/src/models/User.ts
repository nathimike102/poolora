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
  blockReason?: string;
  isBlocked: boolean;
  otpAttempts: number;
  otpLastAttemptAt?: Date;
  isActive: boolean;
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
  },
  { _id: false },
);

const EmergencyContactSchema = new Schema<IEmergencyContact>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    relation: { type: String, required: true, trim: true },
  },
  { _id: false },
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
    blockReason: String,
    isBlocked: { type: Boolean, default: false },
    otpAttempts: { type: Number, default: 0 },
    otpLastAttemptAt: Date,
    isActive: { type: Boolean, default: true },
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
