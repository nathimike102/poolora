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

import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { Ride, PaginatedResponse } from '../types/api';

// ─── Rider bottom tabs ────────────────────────────────────────────────────────

export type RiderTabParamList = {
  RiderHome: undefined;
  Search: { pickedLocation?: string; pickedField?: 'from' | 'to' } | undefined;
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
  OTP: { phone: string; confirmation: FirebaseAuthTypes.ConfirmationResult };
  EmailLogin: undefined;
  EmailSignup: undefined;
  ProfileSetup: undefined;

  // Tab navigators (nested)
  RiderTabs: NavigatorScreenParams<RiderTabParamList>;
  DriverTabs: NavigatorScreenParams<DriverTabParamList>;

  // Rider detail screens (pushed above tabs)
  RideResults: { rides?: PaginatedResponse<Ride> | Ride[] } | undefined;
  Booking: { rideId: string };
  ActiveRide: { rideId: string };
  RideDetail: { rideId: string };
  Payment: { rideId: string; amount: number };
  AddSavedRoute: undefined;

  // Driver detail screens (pushed above tabs)
  Earnings: undefined;
  KYC: undefined;
  PersonalDetails: undefined;
  VehicleDetails: undefined;
  AddVehicle: undefined;
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

  // Map picker
  MapPicker: { field: 'from' | 'to' };
};

// Convenience re-exports so screens don't need two imports
export type { NativeStackNavigationProp } from '@react-navigation/native-stack';
export type { RouteProp } from '@react-navigation/native';
export type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
