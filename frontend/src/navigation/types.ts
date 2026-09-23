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
  Booking: { rideId: string; seats?: number };
  ActiveRide: { rideId: string; bookingId?: string };
  RideDetail: { rideId: string };
  Payment: {
    bookingId: string;
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

  // Parcel flow
  ShipParcel: undefined;
  ParcelResults: undefined;
  ParcelTracking: { parcelId: string };

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
