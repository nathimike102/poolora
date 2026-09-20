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
  MINI = 'mini',
  AUTO = 'auto',
  BIKE = 'bike',
}

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
  UPI = 'upi',
  CARD = 'card',
  WALLET = 'wallet',
  NETBANKING = 'netbanking',
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
}

export interface IEmergencyContact {
  name: string;
  phone: string;
  relation: string;
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
}

export enum RewardTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
  DIAMOND = 'diamond',
}
