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
 * │  │   │   └── Profile → ProfileScreen (driver view)      │
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

import React, { useEffect, useState } from "react";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { ActiveSosBanner } from "../components/ActiveSosBanner";
import { registerForPush } from "../services/pushNotifications";
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
import { LocationIntroScreen } from "../screens/LocationIntroScreen";
import { PhoneNumberScreen } from "../screens/shared/PhoneNumberScreen";
import { GuideScreen } from "../screens/shared/GuideScreen";
import { useTranslation } from 'react-i18next';
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
import { WalletScreen } from "../screens/shared/WalletScreen";
import { ServicesScreen } from "../screens/rider/ServicesScreen";

// ─── Driver screens ───────────────────────────────────────────────────────────
import { DriverHomeScreen } from "../screens/driver/DriverHomeScreen";
import { CreateRideScreen } from "../screens/driver/CreateRideScreen";
import { ManageRequestsScreen } from "../screens/driver/ManageRequestsScreen";
import { EarningsScreen } from "../screens/driver/EarningsScreen";
import { KYCScreen } from "../screens/driver/KYCScreen";
import { UpcomingRidesScreen } from "../screens/driver/UpcomingRidesScreen";
import { DriverRideDetailsScreen } from "../screens/driver/DriverRideDetailsScreen";
import { EditRideScreen } from "../screens/driver/EditRideScreen";
import { ReceiptScreen } from "../screens/rider/ReceiptScreen";
import { ReceiptsScreen } from "../screens/rider/ReceiptsScreen";
import { RaiseDisputeScreen } from "../screens/shared/RaiseDisputeScreen";
import { RateTripScreen } from "../screens/shared/RateTripScreen";
import { HelpScreen } from "../screens/shared/HelpScreen";
import { SupportTicketScreen } from "../screens/shared/SupportTicketScreen";
import { SupportAssistantScreen } from "../screens/shared/SupportAssistantScreen";
import { AppealScreen } from "../screens/shared/AppealScreen";
import { onAccountRestricted, type AccountRestriction } from "../utils/accountRestriction";
import { AddSavedRouteScreen } from "../screens/rider/AddSavedRouteScreen";

// ─── Parcel screens ───────────────────────────────────────────────────────────
import { ShipParcelScreen } from "../screens/parcel/ShipParcelScreen";
import { ParcelResultsScreen } from "../screens/parcel/ParcelResultsScreen";
import { ParcelTrackingScreen } from "../screens/parcel/ParcelTrackingScreen";

// ─── Trip screens ─────────────────────────────────────────────────────────────
import { PlanTripScreen } from "../screens/trip/PlanTripScreen";
import { withServiceArea } from "../components/ServiceArea";
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
import { FakeCallScreen } from "../screens/shared/FakeCallScreen";
import { IdentityCheckScreen } from "../screens/shared/IdentityCheckScreen";
import { ImpactScreen } from "../screens/shared/ImpactScreen";
import { LanguageScreen } from "../screens/shared/LanguageScreen";
import { WorkScreen } from "../screens/shared/WorkScreen";
import { CarTrackerScreen } from "../screens/driver/CarTrackerScreen";
import { MapPickerScreen } from "../screens/rider/MapPickerScreen";
import { AdminDashboardScreen } from "../screens/admin/AdminDashboardScreen";
import { AdminIncidentsScreen } from "../screens/admin/AdminIncidentsScreen";
import { AdminMetricsScreen } from "../screens/admin/AdminMetricsScreen";
import { AdminVerificationsScreen } from "../screens/admin/AdminVerificationsScreen";

import { tc } from '../theme/themed';

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
  const insets = useSafeAreaInsets();
  return [{ paddingBottom: insets.bottom }, tc.backgroundColor_surface];
}

const FULL_BLEED = { contentStyle: { paddingBottom: 0 } } as const;

// ─── Bottom Tab Navigators ────────────────────────────────────────────────────

// Tabs out of view don't re-render until they're opened again, so a change
// that touches every screen (the theme, the language) only redraws the one in
// view. Only tabs: none runs live safety work, which lives in stack screens
// (ActiveRide, SOS) that must keep updating behind whatever is on top.
const TAB_OPTIONS = { headerShown: false, freezeOnBlur: true } as const;

// Booking, parcels, group trips and new rides open only where Poolora has launched
const GatedSearch = withServiceArea(() => SearchScreen, "book");
const GatedShipParcel = withServiceArea(() => ShipParcelScreen, "parcel");
const GatedPlanTrip = withServiceArea(() => PlanTripScreen, "trip");
const GatedCreateRide = withServiceArea(() => CreateRideScreen, "offer", true);

function RiderTabs() {
  const { t } = useTranslation();
  return (
    <RiderTab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={TAB_OPTIONS}
    >
      <RiderTab.Screen
        name="RiderHome"
        component={RiderHomeScreen}
        options={{ title: t('tabs.ride') }}
      />
      <RiderTab.Screen
        name="Services"
        component={ServicesScreen}
        options={{ title: t('tabs.services') }}
      />
      <RiderTab.Screen
        name="MyRides"
        component={MyRidesScreen}
        options={{ title: t('tabs.myRides') }}
      />
      <RiderTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: t('tabs.profile') }}
      />
    </RiderTab.Navigator>
  );
}

function DriverTabs() {
  const { t } = useTranslation();
  return (
    <DriverTab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={TAB_OPTIONS}
    >
      <DriverTab.Screen
        name="DriverHome"
        component={DriverHomeScreen}
        options={{ title: t('tabs.home') }}
      />
      <DriverTab.Screen
        name="CreateRide"
        component={GatedCreateRide}
        options={{ title: t('tabs.createRide') }}
      />
      <DriverTab.Screen
        name="ManageRequests"
        component={ManageRequestsScreen}
        options={{ title: t('tabs.requests') }}
      />
      <DriverTab.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{ title: t('tabs.chat') }}
      />
      <DriverTab.Screen
        name="DriverProfile"
        component={ProfileScreen}
        options={{ title: t('tabs.profile') }}
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
      <Stack.Screen name="LocationIntro" component={LocationIntroScreen} />
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
      {/* A Google or email sign-up adds the phone number during profile setup */}
      <Stack.Screen name="PhoneNumber" component={PhoneNumberScreen} />
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
      <Stack.Screen name="Search" component={GatedSearch} />
      <Stack.Screen name="RideResults" component={RideResultsScreen} options={FULL_BLEED} />
      <Stack.Screen name="Booking" component={BookingScreen} />
      <Stack.Screen name="ActiveRide" component={ActiveRideScreen} />
      <Stack.Screen name="RideDetail" component={RideDetailScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="PhoneNumber" component={PhoneNumberScreen} />
      <Stack.Screen name="Guide" component={GuideScreen} />
      <Stack.Screen name="Receipt" component={ReceiptScreen} />
      <Stack.Screen name="Receipts" component={ReceiptsScreen} />
      <Stack.Screen name="RaiseDispute" component={RaiseDisputeScreen} />
      <Stack.Screen name="RateTrip" component={RateTripScreen} />
      <Stack.Screen name="Help" component={HelpScreen} />
      <Stack.Screen name="SupportTicket" component={SupportTicketScreen} />
      <Stack.Screen name="SupportAssistant" component={SupportAssistantScreen} />
      <Stack.Screen name="Appeal" component={AppealRoute} />
      <Stack.Screen name="AddSavedRoute" component={AddSavedRouteScreen} />

      {/* ── Driver detail screens (pushed above tabs) ─────────── */}
      <Stack.Screen name="Earnings" component={EarningsScreen} />
      <Stack.Screen name="KYC" component={KYCScreen} />
      <Stack.Screen name="UpcomingRides" component={UpcomingRidesScreen} />
      <Stack.Screen
        name="DriverRideDetails"
        component={DriverRideDetailsScreen}
      />
      <Stack.Screen name="EditRide" component={EditRideScreen} />

      {/* ── Parcel Flow ───────────────────────────────────────── */}
      <Stack.Screen name="ShipParcel" component={GatedShipParcel} />
      <Stack.Screen name="ParcelResults" component={ParcelResultsScreen} />
      <Stack.Screen name="ParcelTracking" component={ParcelTrackingScreen} />

      {/* ── Trip Flow ─────────────────────────────────────────── */}
      <Stack.Screen name="PlanTrip" component={GatedPlanTrip} />
      <Stack.Screen name="TripDetail" component={TripDetailScreen} />
      <Stack.Screen name="TripPartners" component={TripPartnersScreen} />

      {/* ── Shared detail screens (pushed above tabs) ─────────── */}
      <Stack.Screen name="Chat" component={ChatScreen} options={FULL_BLEED} />
      <Stack.Screen name="Messages" component={ChatListScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="SOS" component={SOSScreen} />
      <Stack.Screen name="FakeCall" component={FakeCallScreen} options={FULL_BLEED} />
      <Stack.Screen name="IdentityCheck" component={IdentityCheckScreen} />
      <Stack.Screen name="Impact" component={ImpactScreen} />
      <Stack.Screen name="Language" component={LanguageScreen} />
      <Stack.Screen name="Work" component={WorkScreen} />
      <Stack.Screen name="CarTracker" component={CarTrackerScreen} />
      <Stack.Screen
        name="EmergencyContacts"
        component={EmergencyContactsScreen}
      />

      {/* ── Map picker ─────────────────────────────────────────── */}
      <Stack.Screen name="MapPicker" component={MapPickerScreen} options={FULL_BLEED} />

      {/* ── Admin (the backend enforces admin capability on every call) ── */}
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Stack.Screen name="AdminIncidents" component={AdminIncidentsScreen} />
      <Stack.Screen name="AdminMetrics" component={AdminMetricsScreen} />
      <Stack.Screen name="AdminVerifications" component={AdminVerificationsScreen} />
    </Stack.Navigator>
  );
}

// ─── Root navigator ───────────────────────────────────────────────────────────

/** The appeal screen as a pushed route, opened from Help */
function AppealRoute() {
  return <AppealScreen />;
}

const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function AppNavigator() {
  const { role, logout } = useApp();
  // For the SOS bar, which hides on the SOS screen itself
  const [currentRoute, setCurrentRoute] = useState<string | undefined>();
  const trackRoute = () => setCurrentRoute(navigationRef.getCurrentRoute()?.name);
  // Set when the server says this account is blocked or merged (UC-A05)
  const [restriction, setRestriction] = useState<AccountRestriction | null>(null);

  useEffect(() => {
    onAccountRestricted(setRestriction);
    return () => onAccountRestricted(null);
  }, []);
  useEffect(() => {
    if (role === null) setRestriction(null);
    // Signed in: this phone gets the account's push notifications
    else registerForPush();
  }, [role]);

  return (
    <NavigationContainer key={role ?? "auth"} ref={navigationRef} onReady={trackRoute} onStateChange={trackRoute}>
      {role === null ? (
        <AuthNavigator />
      ) : restriction ? (
        <AppealScreen restriction={restriction} onSignOut={() => { setRestriction(null); logout(); }} />
      ) : (
        <ActiveSosBanner navigationRef={navigationRef} currentRoute={currentRoute}>
          <AppNavigatorStack />
        </ActiveSosBanner>
      )}
    </NavigationContainer>
  );
}
