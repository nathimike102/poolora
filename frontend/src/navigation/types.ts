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

import type { ConfirmationResult } from '@react-native-firebase/auth';
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { Ride, PaginatedResponse } from '../types/api';

// ─── Rider bottom tabs ────────────────────────────────────────────────────────

export type RiderTabParamList = {
  RiderHome: undefined;
  Search: { pickedLocation?: string; pickedField?: 'from' | 'to'; from?: string; to?: string } | undefined;
  MyRides: undefined;
  ChatList: undefined;
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
  OTP: { phone: string; confirmation: ConfirmationResult };
  EmailLogin: undefined;
  EmailSignup: undefined;
  ProfileSetup: undefined;

  // Tab navigators (nested)
  RiderTabs: NavigatorScreenParams<RiderTabParamList>;
  DriverTabs: NavigatorScreenParams<DriverTabParamList>;

  // Rider detail screens (pushed above tabs)
  RideResults:
    | {
        rides?: PaginatedResponse<Ride> | Ride[];
        /** What the rider searched for, shown in the results header */
        route?: { from: string; to: string; seats: number };
      }
    | undefined;
  Booking: { rideId: string };
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
