/**
 * navigation/AppNavigator.tsx
 *
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────┐
 * │ NavigationContainer  (key={role} → forces full rebuild) │
 * │                                                         │
 * │  role === null                                          │
 * │  ├── AuthStack                                          │
 * │  │   ├── Splash                                         │
 * │  │   ├── Onboarding                                     │
 * │  │   ├── Login                                          │
 * │  │   ├── PhoneLogin / EmailLogin / EmailSignup          │
 * │  │   ├── OTP                                            │
 * │  │   └── ProfileSetup (defaults to rider)               │
 * │                                                         │
 * │  role !== null                                          │
 * │  ├── AppStack                                           │
 * │  │   ├── RiderTabs  (if rider)                          │
 * │  │   │   ├── Ride  → RiderHomeScreen                    │
 * │  │   │   ├── Services → ServicesScreen                  │
 * │  │   │   ├── My Rides → MyRidesScreen                   │
 * │  │   │   └── Profile → ProfileScreen                    │
 * │  │   │                                                  │
 * │  │   ├── DriverTabs (if driver)                         │
 * │  │   │   ├── Home  → DriverHomeScreen                   │
 * │  │   │   ├── Requests → ManageRequestsScreen            │
 * │  │   │   ├── Earnings → EarningsScreen                  │
 * │  │   │   ├── Chat  → ChatListScreen                     │
 * │  │   │   └── Profile → DriverProfileScreen              │
 * │  │   │                                                  │
 * │  │   ├── Search, RideResults, Booking, ActiveRide ...   │
 * │  │   ├── CreateRide, KYC ...                            │
 * │  │   ├── ShipParcel, ParcelResults ...                  │
 * │  │   └── Chat, Settings, SOS ...                        │
 * └─────────────────────────────────────────────────────────┘
 *
 * KEY INSIGHT — role switching:
 *   The NavigationContainer gets `key={role}`. When role changes
 *   React unmounts the entire old tree and mounts a fresh one,
 *   guaranteeing the correct tab navigator renders immediately.
 */

import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "../context/AppContext";
import { CustomTabBar } from "../components/CustomTabBar";
import type {
  RootStackParamList,
  RiderTabParamList,
  DriverTabParamList,
} from "./types";

// ─── Auth screens ─────────────────────────────────────────────────────────────
import { SplashScreen } from "../screens/SplashScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { PhoneLoginScreen } from "../screens/PhoneLoginScreen";
import { OTPScreen } from "../screens/OTPScreen";
import { EmailLoginScreen } from "../screens/EmailLoginScreen";
import { EmailSignupScreen } from "../screens/EmailSignupScreen";
import { ProfileSetupScreen } from "../screens/ProfileSetupScreen";

// ─── Rider screens ────────────────────────────────────────────────────────────
import { RiderHomeScreen } from "../screens/rider/RiderHomeScreen";
import { SearchScreen } from "../screens/rider/SearchScreen";
import { RideResultsScreen } from "../screens/rider/RideResultsScreen";
import { BookingScreen } from "../screens/rider/BookingScreen";
import { ActiveRideScreen } from "../screens/rider/ActiveRideScreen";
import { RideDetailScreen } from "../screens/rider/RideDetailScreen";
import { MyRidesScreen } from "../screens/rider/MyRidesScreen";
import { PaymentScreen } from "../screens/rider/PaymentScreen";
import { ServicesScreen } from "../screens/rider/ServicesScreen";

// ─── Driver screens ───────────────────────────────────────────────────────────
import { DriverHomeScreen } from "../screens/driver/DriverHomeScreen";
import { CreateRideScreen } from "../screens/driver/CreateRideScreen";
import { ManageRequestsScreen } from "../screens/driver/ManageRequestsScreen";
import { EarningsScreen } from "../screens/driver/EarningsScreen";
import { KYCScreen } from "../screens/driver/KYCScreen";
import { DriverProfileScreen } from "../screens/driver/DriverProfileScreen";
import { UpcomingRidesScreen } from "../screens/driver/UpcomingRidesScreen";
import { DriverRideDetailsScreen } from "../screens/driver/DriverRideDetailsScreen";
import { AddSavedRouteScreen } from "../screens/rider/AddSavedRouteScreen";

// ─── Parcel screens ───────────────────────────────────────────────────────────
import { ShipParcelScreen } from "../screens/parcel/ShipParcelScreen";
import { ParcelResultsScreen } from "../screens/parcel/ParcelResultsScreen";
import { ParcelTrackingScreen } from "../screens/parcel/ParcelTrackingScreen";

// ─── Trip screens ─────────────────────────────────────────────────────────────
import { PlanTripScreen } from "../screens/trip/PlanTripScreen";
import { TripDetailScreen } from "../screens/trip/TripDetailScreen";
import { TripPartnersScreen } from "../screens/trip/TripPartnersScreen";

// ─── Shared screens ──────────────────────────────────────────────────────────
import { ProfileScreen } from "../screens/shared/ProfileScreen";
import { SettingsScreen } from "../screens/shared/SettingsScreen";
import { NotificationsScreen } from "../screens/shared/NotificationsScreen";
import { ChatListScreen } from "../screens/shared/ChatListScreen";
import { ChatScreen } from "../screens/shared/ChatScreen";
import { SOSScreen } from "../screens/shared/SOSScreen";
import { EmergencyContactsScreen } from "../screens/shared/EmergencyContactsScreen";
import { MapPickerScreen } from "../screens/rider/MapPickerScreen";
import { AdminDashboardScreen } from "../screens/admin/AdminDashboardScreen";
import { AdminIncidentsScreen } from "../screens/admin/AdminIncidentsScreen";
import { AdminMetricsScreen } from "../screens/admin/AdminMetricsScreen";
import { AdminVerificationsScreen } from "../screens/admin/AdminVerificationsScreen";

// ─── Navigator instances ──────────────────────────────────────────────────────

const Stack = createNativeStackNavigator<RootStackParamList>();
const RiderTab = createBottomTabNavigator<RiderTabParamList>();
const DriverTab = createBottomTabNavigator<DriverTabParamList>();

/**
 * The app draws edge to edge, so each stack screen is lifted above the Android
 * navigation bar here rather than in every screen. Screens that paint their
 * own bottom edge (tab bar, map sheets, chat composer) opt out with
 * FULL_BLEED.
 */
function useStackContentStyle() {
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  return { backgroundColor: c.bg, paddingBottom: insets.bottom };
}

const FULL_BLEED = { contentStyle: { paddingBottom: 0 } } as const;

// ─── Bottom Tab Navigators ────────────────────────────────────────────────────

function RiderTabs() {
  return (
    <RiderTab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <RiderTab.Screen
        name="RiderHome"
        component={RiderHomeScreen}
        options={{ title: "Ride" }}
      />
      <RiderTab.Screen
        name="Services"
        component={ServicesScreen}
        options={{ title: "Services" }}
      />
      <RiderTab.Screen
        name="MyRides"
        component={MyRidesScreen}
        options={{ title: "My Rides" }}
      />
      <RiderTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: "Profile" }}
      />
    </RiderTab.Navigator>
  );
}

function DriverTabs() {
  return (
    <DriverTab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <DriverTab.Screen
        name="DriverHome"
        component={DriverHomeScreen}
        options={{ title: "Home" }}
      />
      <DriverTab.Screen
        name="CreateRide"
        component={CreateRideScreen}
        options={{ title: "Create Ride" }}
      />
      <DriverTab.Screen
        name="ManageRequests"
        component={ManageRequestsScreen}
        options={{ title: "Requests" }}
      />
      <DriverTab.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{ title: "Chat" }}
      />
      <DriverTab.Screen
        name="DriverProfile"
        component={DriverProfileScreen}
        options={{ title: "Profile" }}
      />
    </DriverTab.Navigator>
  );
}

// ─── Auth Stack ───────────────────────────────────────────────────────────────

function AuthNavigator() {
  const contentStyle = useStackContentStyle();
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        gestureEnabled: true,
        contentStyle,
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} options={FULL_BLEED} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="PhoneLogin" component={PhoneLoginScreen} />
      <Stack.Screen name="OTP" component={OTPScreen} />
      <Stack.Screen name="EmailLogin" component={EmailLoginScreen} />
      <Stack.Screen name="EmailSignup" component={EmailSignupScreen} />
      <Stack.Screen
        name="ProfileSetup"
        component={ProfileSetupScreen}
        options={{ gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
}

// ─── App Stack (authenticated) ────────────────────────────────────────────────

function AppNavigatorStack() {
  const { role } = useApp();
  const contentStyle = useStackContentStyle();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        gestureEnabled: true,
        contentStyle,
      }}
    >
      {/* Tab navigator as the root screen — role determines which one */}
      {role === "driver" ? (
        <Stack.Screen name="DriverTabs" component={DriverTabs} options={FULL_BLEED} />
      ) : (
        <Stack.Screen name="RiderTabs" component={RiderTabs} options={FULL_BLEED} />
      )}

      {/* ── Rider detail screens (pushed above tabs) ──────────── */}
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="RideResults" component={RideResultsScreen} options={FULL_BLEED} />
      <Stack.Screen name="Booking" component={BookingScreen} />
      <Stack.Screen name="ActiveRide" component={ActiveRideScreen} />
      <Stack.Screen name="RideDetail" component={RideDetailScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
      <Stack.Screen name="AddSavedRoute" component={AddSavedRouteScreen} />

      {/* ── Driver detail screens (pushed above tabs) ─────────── */}
      <Stack.Screen name="Earnings" component={EarningsScreen} />
      <Stack.Screen name="KYC" component={KYCScreen} />
      <Stack.Screen name="UpcomingRides" component={UpcomingRidesScreen} />
      <Stack.Screen
        name="DriverRideDetails"
        component={DriverRideDetailsScreen}
      />

      {/* ── Parcel Flow ───────────────────────────────────────── */}
      <Stack.Screen name="ShipParcel" component={ShipParcelScreen} />
      <Stack.Screen name="ParcelResults" component={ParcelResultsScreen} />
      <Stack.Screen name="ParcelTracking" component={ParcelTrackingScreen} />

      {/* ── Trip Flow ─────────────────────────────────────────── */}
      <Stack.Screen name="PlanTrip" component={PlanTripScreen} />
      <Stack.Screen name="TripDetail" component={TripDetailScreen} />
      <Stack.Screen name="TripPartners" component={TripPartnersScreen} />

      {/* ── Shared detail screens (pushed above tabs) ─────────── */}
      <Stack.Screen name="Chat" component={ChatScreen} options={FULL_BLEED} />
      <Stack.Screen name="Messages" component={ChatListScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="SOS" component={SOSScreen} />
      <Stack.Screen
        name="EmergencyContacts"
        component={EmergencyContactsScreen}
      />

      {/* ── Map picker ─────────────────────────────────────────── */}
      <Stack.Screen name="MapPicker" component={MapPickerScreen} options={FULL_BLEED} />

      {/* ── Admin (the backend enforces admin capability on every call) ── */}
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ headerShown: true, title: 'Admin' }} />
      <Stack.Screen name="AdminIncidents" component={AdminIncidentsScreen} options={{ headerShown: true, title: 'Safety incidents' }} />
      <Stack.Screen name="AdminMetrics" component={AdminMetricsScreen} options={{ headerShown: true, title: 'System metrics' }} />
      <Stack.Screen name="AdminVerifications" component={AdminVerificationsScreen} />
    </Stack.Navigator>
  );
}

// ─── Root navigator ───────────────────────────────────────────────────────────

export function AppNavigator() {
  const { role } = useApp();

  return (
    <NavigationContainer key={role ?? "auth"}>
      {role === null ? <AuthNavigator /> : <AppNavigatorStack />}
    </NavigationContainer>
  );
}
