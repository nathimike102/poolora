/**
 * context/AppContext.tsx
 *
 * App-level state: role, theme, user.
 * Navigation is handled by React Navigation — this context manages state only.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { type AppColors, LightColors, DarkColors } from "../theme";
import {
  onAuthStateChanged,
  signOut as signOutFromFirebase,
  restoreAuthState,
  logoutAll,
  devLogin,
  getCurrentUserFromState,
  getCurrentUserFromBackend,
} from "../services/authService";
import { env } from "../config/env";
import { PolicyModal } from "../components/PolicyModal";
import type { User as FirebaseUser } from "@react-native-firebase/auth";
import { logger } from "../utils/logger";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type UserRole = "rider" | "driver" | null;

export interface User {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string;
  isVerified: boolean;
}

interface AppState {
  role: UserRole;
  user: User | null;
  isDarkMode: boolean;
}

export type ActiveTab =
  | "home"
  | "search"
  | "rides"
  | "chat"
  | "earnings"
  | "profile";

interface AppContextValue extends AppState {
  /** Resolved colour tokens for current theme */
  c: AppColors;
  activeTab: ActiveTab;
  /** The raw Firebase user (null if not signed in) */
  firebaseUser: FirebaseUser | null;
  /** Whether Firebase auth state is still loading */
  authLoading: boolean;
  setRole: (role: UserRole) => void;
  setUser: (user: User | null) => void;
  toggleDarkMode: () => void;
  /** Toggle between rider and driver role */
  switchRole: () => void;
  setActiveTab: (tab: ActiveTab) => void;
  /** Sign out from Firebase */
  logout: () => Promise<void>;
}

// ─── Context ───────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const systemScheme = useColorScheme();
  const [role, setRoleState] = useState<UserRole>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("home");
  // null follows the phone's setting live; a boolean is the user's override
  // from toggleDarkMode.
  const [darkOverride, setDarkOverride] = useState<boolean | null>(null);
  const systemDark = systemScheme === "dark";
  const isDarkMode = darkOverride ?? systemDark;

  // Firebase auth state
  const [firebaseUser, setFirebaseUser] =
    useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ── Restore persisted state on mount ─────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [savedRole, savedTheme] = await AsyncStorage.multiGet([
          "@poolora_role",
          "@poolora_dark_mode",
        ]);

        if (savedRole[1] === "rider" || savedRole[1] === "driver") {
          setRoleState(savedRole[1]);
        }

        if (savedTheme[1] === "true" || savedTheme[1] === "false") {
          setDarkOverride(savedTheme[1] === "true");
        }
      } catch {
        // Ignore read errors — start with defaults
      }
    })();
  }, []);

  // Wrapped setRole that also persists to AsyncStorage
  const setRole = useCallback((newRole: UserRole) => {
    setRoleState(newRole);
    if (newRole) {
      AsyncStorage.setItem("@poolora_role", newRole).catch(() => {});
    } else {
      AsyncStorage.removeItem("@poolora_role").catch(() => {});
    }
  }, []);

  // Listen to Firebase auth state changes
  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged((fbUser) => {
        try {
          setFirebaseUser(fbUser);
          if (fbUser) {
            logger.info("Firebase auth state: signed in", { uid: fbUser.uid });
            // Auto-populate app user from Firebase user
            setUser({
              id: fbUser.uid,
              name: fbUser.displayName ?? "",
              phone: fbUser.phoneNumber ?? "",
              avatarUrl: fbUser.photoURL ?? undefined,
              isVerified: true,
            });
          } else {
            logger.info("Firebase auth state: signed out");
            setUser(null);
          }
          setAuthLoading(false);
        } catch (error) {
          logger.error("Error processing auth state change", { error });
          setAuthLoading(false);
        }
      });
      return unsubscribe;
    } catch (error) {
      logger.error("Failed to set up auth state listener", { error });
      setAuthLoading(false);
      return undefined;
    }
  }, []);

  // Restore backend auth state on app startup
  useEffect(() => {
    (async () => {
      try {
        const restored = await restoreAuthState();
        if (restored) {
          logger.info("Backend auth state restored successfully");
          try {
            const u = await getCurrentUserFromBackend();
            setUser({
              id: u._id ?? u.id ?? "",
              name: u.name,
              phone: u.phone,
              avatarUrl: u.profilePhotoUrl,
              isVerified: u.isVerified,
            });
          } catch (error) {
            logger.warn("Could not load the signed-in user", { error });
          }
        } else if (!(__DEV__ && env.DEV_AUTH_BYPASS === "true")) {
          // No usable session: a saved role alone must not open the app.
          logger.debug("No backend auth state to restore");
          setRoleState(null);
          AsyncStorage.removeItem("@poolora_role").catch(() => {});
        }
        // If dev bypass is enabled, perform a local dev login so the app
        // can be used without real authentication.
        // __DEV__ is false in release builds, so this can never ship enabled.
        if (__DEV__ && env.DEV_AUTH_BYPASS === 'true') {
          try {
            await devLogin('rider');
            const u = getCurrentUserFromState();
            if (u) {
              setUser({
                id: u.id ?? u._id,
                name: u.name,
                phone: u.phone,
                avatarUrl: u.profilePhotoUrl,
                isVerified: u.isVerified,
              });
            }
            setRoleState('rider');
            logger.info('Developer bypass login applied');
          } catch (e) {
            logger.warn('Dev bypass login failed', { error: e });
          }
        }
      } catch (error) {
        logger.warn("Failed to restore backend auth state on startup", {
          error,
        });
      }
    })();
  }, []);

  // Policy modal handling
  const [policyVisible, setPolicyVisible] = React.useState(false);
  useEffect(() => {
    (async () => {
      try {
        const accepted = await AsyncStorage.getItem('@poolora_policy_accepted');
        if (!accepted) setPolicyVisible(true);
      } catch {
        setPolicyVisible(true);
      }
    })();
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutAll();
    } catch (error) {
      logger.warn("Error during backend logout", { error });
      // Still proceed with local logout
      await signOutFromFirebase().catch(() => {});
    }
    setUser(null);
    setRoleState(null);
    setActiveTab("home");
    AsyncStorage.removeItem("@poolora_role").catch(() => {});
  }, []);

  // Toggling back to the phone's own setting drops the override, so the app
  // follows the system again instead of staying pinned.
  const toggleDarkMode = useCallback(() => {
    const next = !isDarkMode;
    if (next === systemDark) {
      setDarkOverride(null);
      AsyncStorage.removeItem("@poolora_dark_mode").catch(() => {});
    } else {
      setDarkOverride(next);
      AsyncStorage.setItem("@poolora_dark_mode", String(next)).catch(() => {});
    }
  }, [isDarkMode, systemDark]);

  const switchRole = useCallback(() => {
    setRoleState((prev) => {
      const next: UserRole = prev === "rider" ? "driver" : "rider";
      AsyncStorage.setItem("@poolora_role", next).catch(() => {});
      return next;
    });
    setActiveTab("home");
  }, []);

  // Memoised so components only re-render when theme actually changes
  const c = useMemo<AppColors>(
    () => (isDarkMode ? DarkColors : LightColors),
    [isDarkMode],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      role,
      user,
      isDarkMode,
      activeTab,
      firebaseUser,
      authLoading,
      c,
      setRole,
      setUser,
      setActiveTab,
      switchRole,
      toggleDarkMode,
      logout,
    }),
    [
      role,
      user,
      isDarkMode,
      c,
      activeTab,
      firebaseUser,
      authLoading,
      switchRole,
      toggleDarkMode,
      logout,
      setRole,
      setUser,
      setActiveTab,
    ],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      <PolicyModal visible={policyVisible} onAccept={() => setPolicyVisible(false)} />
    </AppContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp must be used within <AppProvider>");
  }
  return ctx;
}
