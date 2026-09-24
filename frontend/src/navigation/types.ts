/**
 * navigation/types.ts
 *
 * Centralised type definitions for React Navigation.
 *
 * ARCHITECTURE:
 * - RootStackParamList: top-level native stack (auth + app)
 * - RiderTabParamList: rider bottom tabs
 * - DriverTabParamList: driver bottom tabs
 * - Tab navigators are nested inside the root stack as "RiderTabs" / "DriverTabs"
 */

import type { NavigatorScreenParams } from '@react-navigation/native';
import type { Ride, PaginatedResponse } from '../types/api';
import type { VehicleCategory } from '../utils/vehicles';
import type { ParcelDraft } from '../services/parcelService';

type LatLng = { lat: number; lng: number };

// ─── Rider bottom tabs ────────────────────────────────────────────────────────

export type RiderTabParamList = {
  RiderHome: undefined;
  Services: undefined;
  MyRides: undefined;
  Profile: undefined;
};

// ─── Driver bottom tabs ───────────────────────────────────────────────────────

export type DriverTabParamList = {
  DriverHome: undefined;
  CreateRide: undefined;
  ManageRequests: undefined;
  ChatList: undefined;
  DriverProfile: undefined;
};

// ─── Root stack (auth + app) ──────────────────────────────────────────────────

/** A place the rider boards or leaves a ride, with its label. */
export type BookingStop = { lat: number; lng: number; address: string };

export type RootStackParamList = {
  // Auth flow
  Splash: undefined;
  Onboarding: undefined;
  Login: undefined;
  PhoneLogin: undefined;
  OTP: { phone: string };
  EmailLogin: undefined;
  EmailSignup: undefined;
  /** phone + otp: a verified code for a phone with no account yet */
  ProfileSetup: { phone: string; otp: string } | undefined;

  // Tab navigators (nested)
  RiderTabs: NavigatorScreenParams<RiderTabParamList>;
  DriverTabs: NavigatorScreenParams<DriverTabParamList>;

  // Rider detail screens (pushed above tabs)
  /** Pickup and drop entry. Every field is optional and pre-fills the form. */
  Search:
    | {
        /** Saved route: both ends as typed text */
        from?: string;
        to?: string;
        /** A recent or favourite place as the drop; searches immediately */
        drop?: { name: string; subtitle: string; lat?: number; lng?: number };
        /** Address chosen on the map picker */
        pickedLocation?: string;
        pickedField?: 'from' | 'to';
        /** Open the date picker first */
        schedule?: boolean;
        /** Show only this kind of vehicle in the results */
        category?: VehicleCategory;
      }
    | undefined;
  RideResults:
    | {
        rides?: PaginatedResponse<Ride> | Ride[];
        /** What the rider searched for, shown in the results header */
        route?: {
          from: string;
          to: string;
          seats: number;
          pickup?: LatLng;
          dropoff?: LatLng;
          /** ISO time the rider asked for; absent means "now" */
          when?: string;
        };
        category?: VehicleCategory;
      }
    | undefined;
  /**
   * `pickup` and `dropoff` are where the rider searched from and to. They can
   * be anywhere within 2 km of the ride's route; without them the rider boards
   * at the ride's start and leaves at its end.
   */
  Booking: { rideId: string; seats?: number; pickup?: BookingStop; dropoff?: BookingStop };
  ActiveRide: { rideId: string; bookingId?: string };
  RideDetail: { rideId: string; pickup?: BookingStop; dropoff?: BookingStop };
  Receipt: { bookingId: string };
  /** Raise a dispute about a booking; `summary` names the trip on the form */
  RaiseDispute: { bookingId: string; summary?: string };
  RateTrip: { bookingId: string; rateeName: string; summary?: string };
  Help: undefined;
  SupportTicket: { ticketId?: string; bookingId?: string };
  Payment: {
    bookingId: string;
    /** Paying for a parcel instead of a seat; cancelling cancels the parcel */
    parcelId?: string;
    orderId: string;
    keyId: string;
    /** Rupees */
    amount: number;
    summary: string;
  };
  AddSavedRoute: undefined;

  // Driver detail screens (pushed above tabs)
  Earnings: undefined;
  KYC: undefined;
  UpcomingRides: undefined;
  DriverRideDetails: { rideId: string };
  EditRide: { rideId: string };

  // Parcel flow
  ShipParcel: undefined;
  ParcelResults: { draft: ParcelDraft };
  /** `deliveryCode` is passed only right after sending, the one time it is known */
  ParcelTracking: { trackingNumber: string; deliveryCode?: string };

  // Trip flow
  PlanTrip: undefined;
  TripDetail: { tripId: string };
  TripPartners: { tripId: string };

  // Shared detail screens (pushed above tabs)
  Chat: { chatId: string; recipientName: string };
  /** Chat list for riders, whose tab bar has no chat tab */
  Messages: undefined;
  Settings: undefined;
  Notifications: undefined;
  SOS: undefined;
  EmergencyContacts: undefined;

  // Admin screens
  AdminDashboard: undefined;
  AdminIncidents: undefined;
  AdminMetrics: undefined;
  AdminVerifications: undefined;

  // Map picker
  MapPicker: { field: 'from' | 'to' };
};

// Convenience re-exports so screens don't need two imports
export type { NativeStackNavigationProp } from '@react-navigation/native-stack';
export type { RouteProp } from '@react-navigation/native';
export type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
