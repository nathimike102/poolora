import { Request } from 'express';
import type { Types } from 'mongoose';

// ─── Enums ───────────────────────────────────────────────────────────────────

export enum UserCapability {
  RIDER = 'rider',
  DRIVER = 'driver',
  ADMIN = 'admin',
}

export enum KYCStatus {
  NONE = 'none',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum VehicleType {
  SEDAN = 'sedan',
  SUV = 'suv',
  HATCHBACK = 'hatchback',
  /** Kept for vehicles registered before the Zimbabwe classes; not offered to new drivers */
  MINI = 'mini',
  /** Tuk-tuk */
  AUTO = 'auto',
  BIKE = 'bike',
  /** Seven-seat people carrier, e.g. Toyota Noah or Sienta */
  MINIVAN = 'minivan',
  /** Bakkie, single or double cab */
  PICKUP = 'pickup',
}

/**
 * Most seats a ride may offer, by vehicle, not counting the driver.
 * Mirrors REGISTRABLE_VEHICLES in frontend/src/utils/vehicles.ts.
 */
export const MAX_SEATS_BY_VEHICLE: Record<VehicleType, number> = {
  [VehicleType.HATCHBACK]: 4,
  [VehicleType.SEDAN]: 4,
  [VehicleType.MINI]: 4,
  [VehicleType.SUV]: 6,
  [VehicleType.PICKUP]: 4,
  [VehicleType.MINIVAN]: 7,
  [VehicleType.AUTO]: 3,
  [VehicleType.BIKE]: 1,
};

export enum RideStatus {
  SCHEDULED = 'scheduled',
  ACTIVE = 'active',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum RideType {
  CAR_POOL = 'car_pool',
  PARCEL_POOL = 'parcel_pool',
  TRIP_POOL = 'trip_pool',
}

export enum RecurringPattern {
  NONE = 'none',
  WEEKDAYS = 'weekdays',
  WEEKENDS = 'weekends',
  DAILY = 'daily',
}

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  PAYMENT_FAILED = 'payment_failed',
}

export enum PaymentStatus {
  CREATED = 'created',
  AUTHORIZED = 'authorized',
  CAPTURED = 'captured',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  ECOCASH = 'ecocash',
  ONEMONEY = 'onemoney',
  INNBUCKS = 'innbucks',
  CARD = 'card',
  WALLET = 'wallet',
}

export enum SOSStatus {
  TRIGGERED = 'triggered',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  FALSE_ALARM = 'false_alarm',
}

export enum SOSRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum SOSMonitoringState {
  ACTIVE = 'active',
  ESCALATED = 'escalated',
  RESOLVED = 'resolved',
}

export enum SOSCheckInStatus {
  OK = 'ok',
  PARTIAL_OK = 'partial_ok',
  NOT_OK = 'not_ok',
}

export enum FraudLevel {
  CLEAR = 'clear',
  FLAGGED = 'flagged',
  BLOCKED = 'blocked',
}

// ─── GeoJSON ─────────────────────────────────────────────────────────────────

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

// ─── Sub-documents ───────────────────────────────────────────────────────────

export interface IVehicle {
  /** Assigned by Mongoose when the vehicle is pushed onto a user. */
  _id?: Types.ObjectId;
  make: string;
  model: string;
  year: number;
  color: string;
  plateNumber: string;
  vehicleType: VehicleType;
  hasAC: boolean;
  registrationDocUrl: string;
  insuranceDocUrl: string;
  photos: string[];
}

export interface IKYCData {
  status: KYCStatus;
  drivingLicenseUrl?: string;
  licenseNumber?: string;
  submittedAt?: Date;
  reviewedAt?: Date;
  rejectionReason?: string;
  /** Automatic checks run when the application arrives (UC-A01); advisory for the admin */
  autoChecks?: Array<{ check: string; result: 'pass' | 'warn' | 'fail'; detail: string }>;
  autoCheckedAt?: Date;
  /** The background-check vendor's answer, when one is connected (KYC_VERIFY_URL) */
  backgroundCheck?: { status: 'pending' | 'clear' | 'consider' | 'error'; reference?: string; summary?: string; checkedAt?: Date };
}

export interface IEmergencyContact {
  _id?: import('mongoose').Types.ObjectId;
  name: string;
  phone: string;
  relation: string;
  email?: string;
  /** The first person to call (UC-R10 step 4); exactly one contact is primary */
  primary?: boolean;
  /** Whether this contact gets the SOS text; the user chooses */
  notifyOnSos?: boolean;
  /** Set when the contact confirmed by the link in the verification text */
  verifiedAt?: Date;
  verifyTokenHash?: string;
  verifySentAt?: Date;
}

export interface IUserStats {
  totalRidesAsDriver: number;
  totalRidesAsRider: number;
  totalEarnings: number;
  totalSpent: number;
  avgRatingAsDriver: number;
  avgRatingAsRider: number;
  totalRatingsAsDriver: number;
  totalRatingsAsRider: number;
  avgRatingAsOrganizer?: number;
  totalRatingsAsOrganizer?: number;
  cancellationRate: number;
  acceptanceRate: number;
}

// ─── JWT Payload ─────────────────────────────────────────────────────────────

export interface JWTPayload {
  userId: string;
  phone: string;
  capabilities: UserCapability[];
  driverVerified: boolean;
  sessionId: string;
  /** Suspended accounts can read but not post or book (see requireActiveAccount) */
  accountStatus?: 'active' | 'suspended' | 'blocked';
  suspendedUntil?: Date;
}

// ─── Authenticated Request ───────────────────────────────────────────────────

export interface AuthenticatedRequest extends Request {
  user: JWTPayload;
  requestId: string;
}

// ─── API Response ────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  code: number;
  data?: T;
  error?: {
    id: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
  requestId: string;
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginationQuery {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ─── Ride Search / Matching ──────────────────────────────────────────────────

export interface RideSearchParams {
  pickupLng: number;
  pickupLat: number;
  dropoffLng: number;
  dropoffLat: number;
  departureTime: Date;
  radiusKm?: number;
  timeDeviationMins?: number;
  maxPrice?: number;
  womenOnly?: boolean;
  hasAC?: boolean;
  vehicleType?: VehicleType;
  minRating?: number;
  rideType?: RideType;
}

export interface MatchScore {
  rideId: string;
  overallScore: number;
  proximityScore: number;
  timeScore: number;
  ratingScore: number;
  acceptanceScore: number;
  safetyScore: number;
  estimatedFare: number;
  estimatedETA: number;
  distanceKm: number;
}

// ─── Tracking ────────────────────────────────────────────────────────────────

export interface LocationUpdate {
  userId: string;
  bookingId: string;
  location: GeoPoint;
  speed: number;
  heading: number;
  accuracy: number;
  timestamp: number;
}

export interface DistanceMilestone {
  distanceKm: number;
  estimatedMins: number;
  message: string;
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  bookingId: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: Date;
}

// ─── Kafka Events ────────────────────────────────────────────────────────────

export type KafkaTopic =
  | 'user-events'
  | 'ride-events'
  | 'booking-events'
  | 'payment-events'
  | 'location-events'
  | 'safety-events';

export interface KafkaEvent<T = unknown> {
  eventType: string;
  timestamp: string;
  source: string;
  data: T;
  correlationId: string;
}

// ─── Wallet ───────────────────────────────────────────────────────────────────

export enum WalletTransactionType {
  TOPUP = 'topup',
  DEBIT = 'debit',
  REFUND = 'refund',
  COIN_CONVERSION = 'coin_conversion',
  /** Balance moved between accounts when a duplicate is merged (UC-A05) */
  MERGE_IN = 'merge_in',
  MERGE_OUT = 'merge_out',
  /** Sent to the user's mobile money; reversed with a REFUND if the payout is rejected */
  WITHDRAWAL = 'withdrawal',
}

export enum WalletTransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// ─── Rewards / Coins ─────────────────────────────────────────────────────────

export enum CoinTransactionType {
  EARNED = 'earned',
  SPENT = 'spent',
  CONVERTED = 'converted',
  EXPIRED = 'expired',
  BONUS = 'bonus',
  /** Coins moved between accounts when a duplicate is merged (UC-A05) */
  MERGE_IN = 'merge_in',
  MERGE_OUT = 'merge_out',
}

export enum RewardTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
  DIAMOND = 'diamond',
}
