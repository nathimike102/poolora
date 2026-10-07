/**
 * utils/profileDraft.ts
 *
 * Keeps the profile-setup form across a restart. Opening the camera or gallery
 * puts Siham in the background, and on a phone short of memory Android kills
 * it there: when the photo comes back the app starts from the splash screen and
 * the form is gone, which looks like a crash. The form is saved just before the
 * picker opens, and the splash screen sends a restarted app back to it.
 *
 * The draft holds the one-time code of a new sign-up, so it lives in the secure
 * store and only for as long as that code is valid.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { logger } from './logger';

export interface ProfileDraft {
  /** Set for a new phone sign-up: the number and the code verified on the last screen */
  pendingSignup?: { phone: string; otp: string };
  firstName: string;
  lastName: string;
  email: string;
  /** ISO date */
  dob: string | null;
  photoUri: string | null;
  savedAt: number;
}

const KEY = 'siham_profile_draft';
// A new sign-up's code expires after 5 minutes (backend config.otp.expirySeconds)
const SIGNUP_DRAFT_MS = 5 * 60 * 1000;
const SIGNED_IN_DRAFT_MS = 30 * 60 * 1000;

const isWeb = Platform.OS === 'web';

export async function saveProfileDraft(draft: Omit<ProfileDraft, 'savedAt'>): Promise<void> {
  const value = JSON.stringify({ ...draft, savedAt: Date.now() });
  try {
    if (isWeb) await AsyncStorage.setItem(KEY, value);
    else await SecureStore.setItemAsync(KEY, value);
  } catch (error) {
    // Losing the draft only costs retyping the form
    logger.warn('Could not save the profile draft', { error });
  }
}

/** The saved draft, or null when there is none or it is too old to resume. */
export async function loadProfileDraft(): Promise<ProfileDraft | null> {
  try {
    const raw = isWeb ? await AsyncStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as ProfileDraft;
    const maxAge = draft.pendingSignup ? SIGNUP_DRAFT_MS : SIGNED_IN_DRAFT_MS;
    if (Date.now() - draft.savedAt > maxAge) {
      await clearProfileDraft();
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export async function clearProfileDraft(): Promise<void> {
  try {
    if (isWeb) await AsyncStorage.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Nothing to clear
  }
}
