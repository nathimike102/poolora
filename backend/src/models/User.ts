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
import { wasRecentlyClosed } from './ClosedPhone';

// ─── Interface ───────────────────────────────────────────────────────────────

export interface IUser extends Document {
  _id: Types.ObjectId;
  firebaseUid?: string;
  phone: string;
  email?: string;
  /**
   * When the owner of `email` proved it (a Firebase sign-in with a verified
   * address). Unset for an address typed into the profile: only a verified
   * address links sign-ins or makes someone a company admin.
   */
  emailVerifiedAt?: Date;
  /** Set while a booking of theirs is being made, so two cannot pass the same checks at once */
  bookingHoldUntil?: Date;
  name: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other';
  /** The language the app, pushes and messages use for this person (UC-X03); absent means English */
  language?: string;
  /** A confirmed work email at a company on Poolora (UC-C02) */
  work?: { organisation: Types.ObjectId; email: string; verifiedAt: Date };
  /** A work email waiting for its link to be opened; the token hash is never sent out */
  workPending?: { organisation: Types.ObjectId; email: string; tokenHash: string; sentAt: Date };
  /**
   * An ID document and a selfie, checked by an admin (IdentityService). It
   * confirms the person and their gender, which women-only rides rely on.
   */
  identity?: IIdentityCheck;
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
  /**
   * The confidential "did you feel safe?" answers about this person, as a
   * driver and as a rider. Never sent to other users (select: false); used by
   * the safety team and to rank rides.
   */
  safetyRating?: { asDriver?: { avg: number; count: number }; asRider?: { avg: number; count: number } };
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
  /**
   * The new-user perks (a first-ride offer and the like) are spent. Set at
   * sign-up when the number belonged to an account closed recently, so closing
   * and joining again does not earn them twice; set by any perk that is used.
   */
  newUserPerksUsed?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IIdentityCheck {
  status: 'pending' | 'verified' | 'rejected';
  /** The gender the user declared when they sent it; the admin confirms or corrects it */
  declaredGender: 'male' | 'female' | 'other';
  /** Deleted once an admin has decided; only the decision is kept */
  documentUrl?: string;
  selfieUrl?: string;
  photosDeletedAt?: Date;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
  rejectionReason?: string;
}

// ─── Sub-schemas ─────────────────────────────────────────────────────────────

const IdentitySchema = new Schema<IIdentityCheck>(
  {
    status: { type: String, enum: ['pending', 'verified', 'rejected'], required: true },
    declaredGender: { type: String, enum: ['male', 'female', 'other'], required: true },
    // Private files in S3 under kyc/<user>/; shown to admins through short-lived links
    documentUrl: String,
    selfieUrl: String,
    photosDeletedAt: Date,
    submittedAt: { type: Date, required: true },
    reviewedAt: Date,
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: String,
  },
  { _id: false },
);

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
    tracker: {
      type: new Schema({ deviceId: { type: String, required: true }, linkedAt: { type: Date, required: true }, lastReportAt: Date }, { _id: false }),
      default: undefined,
    },
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
    // Scores that start at 5 (utils/ratingScore)
    avgRatingAsDriver: { type: Number, default: 5 },
    avgRatingAsRider: { type: Number, default: 5 },
    totalRatingsAsDriver: { type: Number, default: 0 },
    totalRatingsAsRider: { type: Number, default: 0 },
    /** From trip members after a group trip (UC-T02) */
    avgRatingAsOrganizer: { type: Number, default: 5 },
    totalRatingsAsOrganizer: { type: Number, default: 0 },
    // Sums of the ratings received. No default on purpose: Mongoose fills defaults
    // when it loads a document, which would wipe the sum of an account rated before
    // these existed (ratingSum() works it out from the average for those)
    ratingSumAsDriver: { type: Number },
    ratingSumAsRider: { type: Number },
    ratingSumAsOrganizer: { type: Number },
    cancellationRate: { type: Number, default: 0 },
    acceptanceRate: { type: Number, default: 1 },
    co2SavedKg: { type: Number, default: 0 },
    kmShared: { type: Number, default: 0 },
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
    emailVerifiedAt: { type: Date },
    bookingHoldUntil: { type: Date, select: false },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    dateOfBirth: Date,
    gender: { type: String, enum: ['male', 'female', 'other'] },
    language: { type: String, trim: true, maxlength: 8 },
    work: {
      type: new Schema({
        organisation: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
        email: { type: String, required: true, lowercase: true, trim: true },
        verifiedAt: { type: Date, required: true },
      }, { _id: false }),
      default: undefined,
    },
    workPending: {
      type: new Schema({
        organisation: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
        email: { type: String, required: true, lowercase: true, trim: true },
        tokenHash: { type: String, required: true },
        sentAt: { type: Date, required: true },
      }, { _id: false }),
      default: undefined,
      select: false,
    },
    identity: { type: IdentitySchema, default: undefined },
    safetyRating: {
      type: new Schema({
        asDriver: { avg: Number, count: Number },
        asRider: { avg: Number, count: Number },
      }, { _id: false }),
      select: false,
    },
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
    newUserPerksUsed: Boolean,
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
UserSchema.index({ 'identity.status': 1, 'identity.submittedAt': 1 });
UserSchema.index({ capabilities: 1 });
// One car per tracker
UserSchema.index({ 'vehicles.tracker.deviceId': 1 }, { unique: true, sparse: true });
// A work email belongs to one account; colleagues are found by company
UserSchema.index({ 'work.email': 1 }, { unique: true, sparse: true });
UserSchema.index({ 'work.organisation': 1 }, { sparse: true });
UserSchema.index({ 'workPending.tokenHash': 1 }, { sparse: true });

// Whoever signs up with the number of a recently closed account gets no new-user perks
UserSchema.pre('save', async function () {
  if (this.isNew && !this.newUserPerksUsed && (await wasRecentlyClosed(this.phone))) {
    this.newUserPerksUsed = true;
  }
});

export const User = mongoose.model<IUser>('User', UserSchema);
