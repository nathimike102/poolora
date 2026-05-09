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
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type AppColors, LightColors, DarkColors } from '../theme';
import { onAuthStateChanged, signOut as firebaseSignOut, restoreAuthState as restoreBackendAuth } from '../services/authService';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { logger } from '../utils/logger';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type UserRole = 'rider' | 'driver' | null;

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

export type ActiveTab = 'home' | 'search' | 'rides' | 'chat' | 'earnings' | 'profile';

interface AppContextValue extends AppState {
  /** Resolved colour tokens for current theme */
  c: AppColors;
  activeTab: ActiveTab;
  /** The raw Firebase user (null if not signed in) */
  firebaseUser: FirebaseAuthTypes.User | null;
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
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  // Default to system preference; user can override via toggleDarkMode
  const [isDarkMode, setIsDarkMode] = useState(systemScheme === 'dark');

  // Firebase auth state
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ── Restore persisted state on mount ─────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [, savedTheme] = await AsyncStorage.multiGet([
          '@ridepool_role',
          '@ridepool_dark_mode',
        ]);
        if (savedTheme[1] !== null) {
          setIsDarkMode(savedTheme[1] === 'true');
        }
      } catch (_) {
        // Ignore read errors — start with defaults
      }
    })();
  }, []);

  // Wrapped setRole that also persists to AsyncStorage
  const setRole = useCallback((newRole: UserRole) => {
    setRoleState(newRole);
  }, []);

  // Listen to Firebase auth state changes
  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged((fbUser) => {
        try {
          setFirebaseUser(fbUser);
          if (fbUser) {
            // Auto-populate app user from Firebase user
            setUser({
              id: fbUser.uid,
              name: fbUser.displayName ?? '',
              phone: fbUser.phoneNumber ?? '',
              avatarUrl: fbUser.photoURL ?? undefined,
              isVerified: true,
            });
          } else {
            setUser(null);
          }
          setAuthLoading(false);
        } catch (error) {
          logger.error('Error processing auth state change', { error });
          setAuthLoading(false);
        }
      });
      return unsubscribe;
    } catch (error) {
      logger.error('Failed to set up auth state listener', { error });
      setAuthLoading(false);
      return undefined;
    }
  }, []);

  // Restore backend auth state on app startup
  useEffect(() => {
    (async () => {
      try {
        const restored = await restoreBackendAuth();
        if (!restored) {
          logger.debug('No backend auth state to restore');
        }
      } catch (error) {
        logger.warn('Failed to restore backend auth state on startup', { error });
      }
    })();
  }, []);

  const logout = useCallback(async () => {
    try {
      // Import logoutAll here to avoid circular dependency
      const { logoutAll } = await import('../services/authService');
      await logoutAll();
    } catch (error) {
      logger.warn('Error during backend logout', { error });
      // Still proceed with local logout
      await firebaseSignOut();
    }
    setUser(null);
    setRoleState(null);
    setActiveTab('home');
    AsyncStorage.removeItem('@ridepool_role').catch(() => {});
  }, []);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => {
      const next = !prev;
      AsyncStorage.setItem('@ridepool_dark_mode', String(next)).catch(() => {});
      return next;
    });
  }, []);

  const switchRole = useCallback(() => {
    setRoleState(prev => {
      const next: UserRole = prev === 'rider' ? 'driver' : 'rider';
      return next;
    });
    setActiveTab('home');
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
    [role, user, isDarkMode, c, activeTab, firebaseUser, authLoading, switchRole, toggleDarkMode, logout],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within <AppProvider>');
  }
  return ctx;
}
