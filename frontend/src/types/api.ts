/**
 * types/api.ts
 * 
 * API request and response types
 */

// ─── Generic API Response ──────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  code: number;
  data: T;
  timestamp: string;
  requestId: string;
}

export interface PaginatedResult<T = unknown> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  /** Ride search only: rides found with a wider window and radius when nothing matched */
  alternatives?: { items: T[]; total: number; radiusKm: number; timeDeviationMins: number };
}

// Backward-compatible alias used across screens/services.
export type PaginatedResponse<T = unknown> = ApiResponse<PaginatedResult<T>>;

// ─── Auth Types ────────────────────────────────────────────────────────────

export interface SendOtpRequest {
  phone: string;
}

export interface SendOtpResponse {
  message: string;
}

export interface VerifyOtpRequest {
  phone: string;
  otp: string;
  name?: string;
  email?: string;
  dateOfBirth?: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
}

export interface VerifyOtpResponse extends AuthToken {
  user: User;
  isNewUser: boolean;
}

export interface FirebaseLoginRequest {
  idToken: string;
}

export interface FirebaseLoginResponse extends AuthToken {
  user: User;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

// ─── User Types ────────────────────────────────────────────────────────────

export type UserCapability = 'rider' | 'driver' | 'admin';
export type KYCStatus = 'none' | 'pending' | 'approved' | 'rejected';
export type VehicleType = 'sedan' | 'suv' | 'hatchback' | 'mini' | 'auto' | 'bike';
export type UserGender = 'male' | 'female' | 'other';

export interface User {
  _id: string;
  id?: string; // alias for frontend
  phone: string;
  email?: string;
  name: string;
  dateOfBirth?: string;
  gender?: UserGender;
  profilePhotoUrl?: string;
  /** On a driver in search results: has the Verified Driver badge */
  verified?: boolean;
  capabilities: UserCapability[];
  isVerified: boolean;
  stats?: UserStats;
  kyc?: KYCData;
  vehicles?: Vehicle[];
  emergencyContacts?: EmergencyContact[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserStats {
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

export interface KYCData {
  status: KYCStatus;
  drivingLicenseUrl?: string;
  licenseNumber?: string;
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface Vehicle {
  _id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  plateNumber: string;
  vehicleType: VehicleType;
  hasAC: boolean;
  registrationDocUrl: string;
  insuranceDocUrl: string;
  photos?: string[];
}

export interface EmergencyContact {
  _id?: string;
  name: string;
  phone: string;
  relation: string;
  email?: string;
  /** The first person to call; exactly one contact is primary */
  primary?: boolean;
  /** Gets the SOS text (default true) */
  notifyOnSos?: boolean;
  /** Confirmed by the link in the verification text (UC-R10) */
  verified?: boolean;
  verificationSentAt?: string;
}

// ─── Ride Types ────────────────────────────────────────────────────────────

export type RideStatus = 'scheduled' | 'active' | 'in_progress' | 'completed' | 'cancelled';
export type RideType = 'economy' | 'premium' | 'shared';

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface Location {
  lat: number;
  lng: number;
  address?: string;
  placeId?: string;
}

export interface Ride {
  _id: string;
  driver: User;
  pickupLocation: Location;
  dropoffLocation: Location;
  scheduledDeparture: string; // ISO datetime
  estimatedArrival?: string; // ISO datetime
  seats: number;
  availableSeats: number;
  pricePerSeat: number;
  totalPrice?: number;
  status: RideStatus;
  rideType: RideType;
  vehicle?: Vehicle;
  stops?: Location[];
  description?: string;
  amenities?: string[];
  womenOnly: boolean;
  hasAC: boolean;
  allowLuggage: boolean;
  passengers?: User[];
  ratings?: Rating[];
  /** From the backend route calculation */
  estimatedDistanceKm?: number;
  estimatedDurationMins?: number;
  /** Encoded road route from pickup to drop */
  routePolyline?: string;
  preferences?: RidePreferences;
  /** 0-100 match score from ride search */
  matchScore?: number;
  /** The driver has the Verified Driver badge (UC-D10) */
  driverVerified?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A rider's booked ride as returned by /rides/upcoming */
/** GET /bookings/:id/cancellation-quote */
export interface CancellationQuote {
  fare: number;
  refundAmount: number;
  refundPercent: number;
  /** Platform fee kept from this cancellation, when the fee is non-refundable */
  platformFeeKept?: number;
  platformFeeRefundable?: boolean;
  policy: Array<{ minHoursBeforeDeparture: number; refundPercent: number }>;
}

export interface UpcomingBooking {
  rideId: string;
  bookingId: string;
  from: string;
  to: string;
  departureTime: string;
  pricePerSeat: number;
  driverName: string;
  status: BookingStatus;
}

export interface RidePreferences {
  womenOnly: boolean;
  smokingAllowed: boolean;
  petsAllowed: boolean;
  luggageSize: 'none' | 'small' | 'medium' | 'large';
  maxDetourMins: number;
}

/** Matches the backend's createRideSchema */
export interface CreateRideRequest {
  vehicleId: string;
  pickup: { lat: number; lng: number; address: string };
  dropoff: { lat: number; lng: number; address: string };
  /** ISO datetime in the future */
  departureTime: string;
  totalSeats: number;
  pricePerSeat: number;
  preferences: {
    womenOnly: boolean;
    smokingAllowed: boolean;
    petsAllowed: boolean;
    luggageSize: 'none' | 'small' | 'medium' | 'large';
  };
  /** Up to three stops on the way, in order */
  waypoints?: Array<{ lat: number; lng: number; address: string }>;
  /** Also publish the same ride back the other way at this time */
  returnDepartureTime?: string;
}

/** GET /rides/price-suggestion */
export interface PriceSuggestion {
  suggested: number;
  min: number;
  max: number;
  distanceKm: number;
  durationMins: number;
  surge: number;
  peak: boolean;
  explanation: string;
}

/** POST /rides: the ride, and the return ride when one was asked for */
export interface CreateRideResult {
  ride: Ride;
  returnRide?: Ride;
  /** Why the return ride could not be published; the outbound ride stands */
  returnError?: string;
}

/** GET /users/me/verified-status (UC-D10) */
export interface VerifiedStatus {
  verified: boolean;
  checks: Array<{ label: string; met: boolean; progress: string }>;
}

/** GET /users/me/statement (UC-D09) */
export interface EarningsStatement {
  month: string;
  lines: Array<{ date: string; kind: 'Trip' | 'Late cancellation' | 'No-show'; route: string; rider: string; fare: number; platformFee: number; earnings: number }>;
  totals: { fare: number; platformFee: number; earnings: number; trips: number };
}

export interface SearchRidesRequest {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  departureTime: string;
  radiusKm?: number;
  timeDeviationMins?: number;
  maxPrice?: number;
  womenOnly?: boolean;
  hasAC?: boolean;
  vehicleType?: VehicleType;
  minRating?: number;
  rideType?: RideType;
  page?: number;
  limit?: number;
}

// ─── Booking Types ─────────────────────────────────────────────────────────

export type BookingStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'completed';

export interface Booking {
  _id: string;
  ride: Ride;
  rider: User;
  status: BookingStatus;
  seatsBooked: number;
  totalPrice: number;
  pickupLocation: Location;
  dropoffLocation: Location;
  specialRequirements?: string;
  /** Populated driver (public fields; phone only once confirmed) */
  driver?: User;
  /** 0-100 route and schedule match computed when the booking was made */
  matchScore?: number;
  estimatedFare?: number;
  cancellationReason?: string;
  /** Set by the backend when the booking is completed */
  driverEarnings?: number;
  finalFare?: number;
  pickup?: { address?: string; location?: { coordinates: [number, number] } };
  dropoff?: { address?: string; location?: { coordinates: [number, number] } };
  /** Message from the rider to the driver with the request */
  note?: string;
  /** The driver is at this rider's pickup; the no-show wait counts from here */
  driverArrivedAt?: string;
  actualPickupTime?: string;
  actualDropoffTime?: string;
  noShow?: boolean;
  refundAmount?: number;
  /** The driver moved the departure after this booking: cancelling is free */
  rideChangedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** GET /bookings/:id/receipt */
export interface Receipt {
  receiptNumber: string;
  issuedAt: string;
  status: 'completed' | 'cancelled' | 'no_show' | 'confirmed';
  rider: { name: string };
  driver: { name: string; vehicle?: string };
  trip: { from: string; to: string; departure: string; seats: number };
  fare: number;
  pricePerSeat: number;
  serviceFee: number;
  refunded: number;
  paid: number;
  paymentMethod: string;
}

export interface CreateBookingRequest {
  rideId: string;
  seatsBooked: number;
  pickup: { lat: number; lng: number; address: string };
  dropoff: { lat: number; lng: number; address: string };
  /** Pay from wallet balance instead of Razorpay */
  useWallet?: boolean;
  /** Optional message to the driver */
  note?: string;
}

export interface RazorpayOrder {
  id: string;
  amount: number; // paise
  currency: string;
}

export interface CreateBookingResult {
  booking: Booking;
  razorpayOrder: RazorpayOrder | null;
  razorpayKeyId?: string;
  paidViaWallet: boolean;
}

// ─── Rating Types ──────────────────────────────────────────────────────────

export interface Rating {
  _id: string;
  ride: string; // ride ID
  rater: User;
  ratee: User;
  /** 1-5, named `score` by the backend */
  score: number;
  comment?: string;
  tags?: string[];
  createdAt: string;
}

export interface CreateRatingRequest {
  rideId: string;
  rating: number;
  review?: string;
}

// ─── Payment Types ─────────────────────────────────────────────────────────

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Payment {
  _id: string;
  booking?: string; // booking ID
  user: User;
  amount: number;
  currency: string;
  status: PaymentStatus;
  transactionId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentRequest {
  bookingId: string;
  amount: number;
}

// ─── Chat Types ────────────────────────────────────────────────────────────

export interface Conversation {
  _id: string;
  participants: User[];
  lastMessage?: Message;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  _id: string;
  conversation: string; // conversation ID
  sender: User;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export interface SendMessageRequest {
  bookingId: string;
  content: string;
  contentType?: 'text' | 'image' | 'location';
}

// ─── Notification Types ────────────────────────────────────────────────────

export type NotificationType =
  | 'ride_request'
  | 'ride_confirmed'
  | 'ride_cancelled'
  | 'ride_started'
  | 'ride_completed'
  | 'new_message'
  | 'rating_received'
  | 'payment_received'
  | 'system';

export interface Notification {
  _id: string;
  user: string; // user ID
  type: NotificationType;
  title: string;
  body: string;
  data?: unknown;
  isRead: boolean;
  createdAt: string;
}

// ─── Wallet Types ──────────────────────────────────────────────────────────

export interface Wallet {
  _id: string;
  user: string; // user ID
  balance: number;
  coins: number;
  totalEarnings: number;
  totalSpent: number;
  tier: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  _id: string;
  wallet: string; // wallet ID
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  relatedEntity?: string; // ride ID, booking ID, etc.
  createdAt: string;
}

export interface TopUpRequest {
  amount: number;
}

// ─── Query Parameters ──────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
