/**
 * services/authService.ts
 *
 * Unified auth service layer combining:
 * - Firebase authentication (phone OTP, Google Sign-In)
 * - Backend API integration (token management, user session)
 */

import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged as onFirebaseAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut as firebaseSignOut,
  updateProfile,
  type ConfirmationResult,
  type User as FirebaseUser,
  type UserCredential,
} from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID } from '@env';
import { apiClient, setAuthorizationHeader, clearAuthorizationHeader } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import { tokenStorage } from '../utils/tokenStorage';
import { logger } from '../utils/logger';
import { getJwtExpiresAtMs } from '../utils/jwt';
import type {
  ApiResponse,
  VerifyOtpResponse,
  FirebaseLoginResponse,
  RefreshTokenResponse,
  User,
} from '../types/api';

type ErrorLike = {
  code?: string;
  message?: string;
};

// Configure Google Sign-In with the web client ID from environment
try {
  if (GOOGLE_WEB_CLIENT_ID) {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
    });
    logger.info('Google Sign-In configured successfully');
  } else {
    logger.warn('GOOGLE_WEB_CLIENT_ID not set - Google Sign-In will not be available');
  }
} catch (error) {
  logger.error('Failed to configure Google Sign-In', { error });
}

// ─── Global Auth State ─────────────────────────────────────────────────────
let currentAccessToken: string | null = null;
let currentUser: User | null = null;

function getErrorDetails(error: unknown): ErrorLike {
  if (typeof error === 'object' && error !== null) {
    const details = error as ErrorLike;
    return {
      code: details.code,
      message: details.message,
    };
  }

  return {};
}

function setLocalAuthState(accessToken: string, user?: User): void {
  currentAccessToken = accessToken;
  if (user) {
    currentUser = user;
  }
}

function clearLocalAuthState(): void {
  currentAccessToken = null;
  currentUser = null;
}

/**
 * Send an OTP to the given phone number.
 *
 * @param phoneNumber - Full international phone number, e.g. '+919876543210'
 * @returns ConfirmationResult which is used to confirm the OTP code later
 * @throws FirebaseAuthError if the number is invalid or rate-limited
 */
export async function sendOtp(
  phoneNumber: string,
): Promise<ConfirmationResult> {
  try {
    const confirmation = await signInWithPhoneNumber(getAuth(), phoneNumber);
    return confirmation;
  } catch (error) {
    // Re-throw with a user-friendly message
    const { code, message } = getErrorDetails(error);
    switch (code) {
      case 'auth/invalid-phone-number':
        throw new Error('The phone number is invalid. Please check and try again.');
      case 'auth/too-many-requests':
        throw new Error('Too many attempts. Please wait a moment and try again.');
      case 'auth/quota-exceeded':
        throw new Error('SMS quota exceeded. Please try again later.');
      case 'auth/network-request-failed':
        throw new Error('Network error. Please check your internet connection.');
      default:
        throw new Error(message ?? 'Failed to send OTP. Please try again.');
    }
  }
}

// Backward-compatible alias. Prefer sendOtp.
export const sendOTP = sendOtp;

/**
 * Verify the OTP code against the confirmation result.
 *
 * @param confirmation - The ConfirmationResult from sendOtp
 * @param code - The 6-digit OTP code entered by the user
 * @returns UserCredential on success
 * @throws Error with user-friendly message on failure
 */
export async function confirmOtp(
  confirmation: ConfirmationResult,
  code: string,
): Promise<UserCredential> {
  try {
    const userCredential = await confirmation.confirm(code);
    if (!userCredential) {
      throw new Error('Verification failed. Please try again.');
    }
    return userCredential;
  } catch (error) {
    const { code: errorCode, message } = getErrorDetails(error);
    switch (errorCode) {
      case 'auth/invalid-verification-code':
        throw new Error('Invalid OTP code. Please check and try again.');
      case 'auth/session-expired':
        throw new Error('OTP has expired. Please request a new one.');
      default:
        throw new Error(message ?? 'Verification failed. Please try again.');
    }
  }
}

// Backward-compatible alias. Prefer confirmOtp.
export const confirmOTP = confirmOtp;

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(getAuth());
}

/**
 * Subscribe to auth state changes.
 * Returns an unsubscribe function.
 */
export function onAuthStateChanged(
  callback: (user: FirebaseUser | null) => void,
): () => void {
  return onFirebaseAuthStateChanged(getAuth(), callback);
}

/**
 * Get the currently signed-in user (or null).
 */
export function getCurrentUser(): FirebaseUser | null {
  return getAuth().currentUser;
}

/**
 * Sign in with email and password.
 */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<UserCredential> {
  try {
    return await signInWithEmailAndPassword(getAuth(), email, password);
  } catch (error) {
    const { code, message } = getErrorDetails(error);
    switch (code) {
      case 'auth/invalid-email':
        throw new Error('The email address is invalid.');
      case 'auth/user-disabled':
        throw new Error('This account has been disabled.');
      case 'auth/user-not-found':
        throw new Error('No account found with this email.');
      case 'auth/wrong-password':
        throw new Error('Incorrect password. Please try again.');
      case 'auth/invalid-credential':
        throw new Error('Invalid email or password. Please try again.');
      case 'auth/network-request-failed':
        throw new Error('Network error. Please check your internet connection.');
      default:
        throw new Error(message ?? 'Sign-in failed. Please try again.');
    }
  }
}

/**
 * Create a new account with email and password.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<UserCredential> {
  try {
    const userCredential = await createUserWithEmailAndPassword(getAuth(), email, password);
    await updateProfile(userCredential.user, { displayName });
    return userCredential;
  } catch (error) {
    const { code, message } = getErrorDetails(error);
    switch (code) {
      case 'auth/email-already-in-use':
        throw new Error('An account with this email already exists.');
      case 'auth/invalid-email':
        throw new Error('The email address is invalid.');
      case 'auth/weak-password':
        throw new Error('Password is too weak. Use at least 6 characters.');
      case 'auth/network-request-failed':
        throw new Error('Network error. Please check your internet connection.');
      default:
        throw new Error(message ?? 'Sign-up failed. Please try again.');
    }
  }
}

/**
 * Send a password reset email.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(getAuth(), email);
  } catch (error) {
    const { code, message } = getErrorDetails(error);
    switch (code) {
      case 'auth/user-not-found':
        throw new Error('No account found with this email.');
      case 'auth/invalid-email':
        throw new Error('The email address is invalid.');
      default:
        throw new Error(message ?? 'Failed to send reset email. Please try again.');
    }
  }
}

/**
 * Sign in with Google.
 * Opens the Google account picker, then authenticates with Firebase.
 *
 * @returns UserCredential on success
 * @throws Error with user-friendly message on failure
 */
export async function signInWithGoogle(): Promise<UserCredential> {
  try {
    // Check Play Services availability
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Open Google account picker
    await GoogleSignin.signIn();

    const { idToken } = await GoogleSignin.getTokens();

    if (!idToken) {
      throw new Error('Google Sign-In failed: no ID token received.');
    }

    // Create a Firebase credential with the Google ID token
    const googleCredential = GoogleAuthProvider.credential(idToken);

    // Sign in to Firebase with the credential
    const userCredential = await signInWithCredential(getAuth(), googleCredential);
    return userCredential;
  } catch (error) {
    const { code, message } = getErrorDetails(error);
    logger.error('Google sign-in failed', { code, message });
    // User cancelled the sign-in flow
    if (code === 'SIGN_IN_CANCELLED' || code === '12501') {
      throw new Error('Sign-in was cancelled.');
    }
    if (code === 'IN_PROGRESS') {
      throw new Error('Sign-in is already in progress.');
    }
    if (code === 'PLAY_SERVICES_NOT_AVAILABLE') {
      throw new Error('Google Play Services is not available on this device.');
    }
    throw new Error(message ?? 'Google Sign-In failed. Please try again.');
  }
}

// ─── Backend Integration Functions ────────────────────────────────────────

/**
 * Backend-integrated sendOtp
 * @param phone - Full international phone number
 */
export async function sendOtpToBackend(phone: string): Promise<void> {
  try {
    await apiClient.post(API_ENDPOINTS.auth.sendOtp, { phone });
    logger.info('OTP sent to backend', { phone });
  } catch (error) {
    logger.error('Failed to send OTP to backend', { error, phone });
    throw error;
  }
}

/**
 * Verify OTP with backend and get JWT tokens
 *
 * @param phone - Phone that received OTP
 * @param otp - 6-digit OTP code
 * @param name - User's name (for new users)
 * @param email - User's email (optional)
 * @returns User and tokens
 */
export async function verifyOtpWithBackend(
  phone: string,
  otp: string,
  name?: string,
  email?: string,
  dateOfBirth?: string,
): Promise<VerifyOtpResponse> {
  try {
    const response = await apiClient.post<ApiResponse<VerifyOtpResponse>>(API_ENDPOINTS.auth.verifyOtp, {
      phone,
      otp,
      name,
      email,
      dateOfBirth,
    });

    const { user, accessToken, refreshToken, isNewUser } = response.data.data;

    // Store tokens
    await storeAuthTokens(accessToken, refreshToken);

    // Store user ID
    const userId = user._id ?? user.id;
    if (!userId) {
      throw new Error('Backend response did not include a user id.');
    }
    await tokenStorage.saveUserId(userId);

    // Update global state
    setLocalAuthState(accessToken, user);

    logger.info('User verified with OTP', { userId, isNewUser });

    return response.data.data;
  } catch (error) {
    logger.error('OTP verification failed', { error, phone });
    throw error;
  }
}

/**
 * Exchange Firebase token for JWT tokens with backend
 *
 * @param firebaseToken - Firebase ID token
 * @returns User and JWT tokens
 */
export async function firebaseLoginWithBackend(
  firebaseToken: string,
): Promise<FirebaseLoginResponse> {
  try {
    const response = await apiClient.post<ApiResponse<FirebaseLoginResponse>>(
      API_ENDPOINTS.auth.firebaseLogin,
      { idToken: firebaseToken },
    );

    const { user, accessToken, refreshToken } = response.data.data;

    // Store tokens
    await storeAuthTokens(accessToken, refreshToken);

    // Store user ID
    const userId = user._id ?? user.id;
    if (!userId) {
      throw new Error('Backend response did not include a user id.');
    }
    await tokenStorage.saveUserId(userId);

    // Update global state
    setLocalAuthState(accessToken, user);

    logger.info('Firebase login successful with backend', { userId });

    return response.data.data;
  } catch (error) {
    logger.error('Firebase backend login failed', { error });
    throw error;
  }
}

/**
 * Refresh JWT access token
 */
export async function refreshAccessToken(): Promise<string> {
  try {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await apiClient.post<ApiResponse<RefreshTokenResponse>>(
      API_ENDPOINTS.auth.refreshToken,
      { refreshToken },
    );

    const { accessToken, refreshToken: newRefreshToken } = response.data.data;

    // Update stored tokens
    await storeAuthTokens(accessToken, newRefreshToken);

    // Update header and global state
    setAuthorizationHeader(accessToken);
    setLocalAuthState(accessToken);

    logger.info('Token refreshed successfully');
    return accessToken;
  } catch (error) {
    logger.error('Token refresh failed', { error });
    // Clear auth on refresh failure
    await logoutAll();
    throw error;
  }
}

/**
 * Get current user from backend
 */
export async function getCurrentUserFromBackend(): Promise<User> {
  try {
    const response = await apiClient.get<ApiResponse<{ user: User }>>(API_ENDPOINTS.auth.me);
    const user = response.data.data.user;
    currentUser = user;
    return user;
  } catch (error) {
    logger.error('Failed to get current user', { error });
    throw error;
  }
}

/**
 * Logout from backend and Firebase
 */
export async function logoutAll(): Promise<void> {
  try {
    // Call backend logout
    try {
      await apiClient.post(API_ENDPOINTS.auth.logout, {});
    } catch (error) {
      logger.warn('Backend logout failed, continuing with local logout', { error });
    }

    // Clear backend auth
    await tokenStorage.clearTokens();
    clearAuthorizationHeader();
    clearLocalAuthState();

    // Sign out from Firebase
    await firebaseSignOut(getAuth());

    logger.info('User logged out successfully');
  } catch (error) {
    logger.error('Logout error', { error });
    throw error;
  }
}

/**
 * Submit KYC data to backend
 */
export async function submitKycToBackend(
  data: Record<string, unknown>,
): Promise<User> {
  try {
    const response = await apiClient.post<ApiResponse<{ user: User }>>(API_ENDPOINTS.auth.submitKyc, data);
    const user = response.data.data.user;
    currentUser = user;
    logger.info('KYC submitted successfully');
    return user;
  } catch (error) {
    logger.error('KYC submission failed', { error });
    throw error;
  }
}

// ─── Helper Functions ──────────────────────────────────────────────────────

/**
 * Store auth tokens securely
 */
async function storeAuthTokens(accessToken: string, refreshToken: string): Promise<void> {
  try {
    const expiresAt = getJwtExpiresAtMs(accessToken) ?? undefined;
    await tokenStorage.saveTokens({
      accessToken,
      refreshToken,
      expiresAt,
    });

    setAuthorizationHeader(accessToken);
    logger.debug('Auth tokens stored');
  } catch (error) {
    logger.error('Failed to store auth tokens', { error });
    throw error;
  }
}

/**
 * Restore auth state from storage (call on app startup)
 */
export async function restoreAuthState(): Promise<boolean> {
  try {
    const tokens = await tokenStorage.getTokens();
    if (!tokens) {
      logger.debug('No stored tokens found');
      return false;
    }

    const { accessToken, expiresAt } = tokens;

    // Check if token is expired or about to expire
    if (expiresAt && Date.now() >= expiresAt - 5 * 60 * 1000) {
      logger.info('Stored token expired, attempting refresh');
      try {
        await refreshAccessToken();
      } catch (error) {
        logger.warn('Token refresh on restore failed', { error });
        await tokenStorage.clearTokens();
        clearAuthorizationHeader();
        clearLocalAuthState();
        return false;
      }
    } else if (accessToken) {
      setAuthorizationHeader(accessToken);
      setLocalAuthState(accessToken);
      logger.info('Auth state restored from storage');
    }

    return true;
  } catch (error) {
    logger.error('Failed to restore auth state', { error });
    return false;
  }
}

/**
 * Get current access token
 */
export function getCurrentAccessToken(): string | null {
  return currentAccessToken;
}

/**
 * Get current user
 */
export function getCurrentUserFromState(): User | null {
  return currentUser;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!currentAccessToken && !!currentUser;
}

/**
 * Development-only login helper.
 * Stores fake tokens and a fake user so the app can operate without real auth.
 */
export async function devLogin(role: 'rider' | 'driver' = 'rider'): Promise<void> {
  const fakeUser: User = {
    _id: 'dev-user',
    id: 'dev-user',
    name: 'Developer',
    phone: '+10000000000',
    capabilities: [role],
    isVerified: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const accessToken = 'dev-access-token';
  const refreshToken = 'dev-refresh-token';
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

  await tokenStorage.saveTokens({ accessToken, refreshToken, expiresAt });
  await tokenStorage.saveUserId(fakeUser._id);

  setAuthorizationHeader(accessToken);
  setLocalAuthState(accessToken, fakeUser);
}
