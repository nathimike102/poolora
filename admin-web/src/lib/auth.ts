/**
 * Sign-in: Firebase (email and password, or Google) proves who the admin
 * is; the backend exchanges the Firebase ID token for its own session and
 * the account must have the admin capability.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  type Auth,
} from 'firebase/auth';
import { api, tokens, ApiError, API_URL } from './api';

export interface AdminUser {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  capabilities: string[];
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app: FirebaseApp | null = null;
function auth(): Auth {
  if (!firebaseConfigured) throw new ApiError('Sign-in is not configured: set the VITE_FIREBASE_* variables.', 0);
  app ??= initializeApp(firebaseConfig);
  return getAuth(app);
}

async function exchange(idToken: string): Promise<AdminUser> {
  const res = await fetch(`${API_URL}/auth/firebase-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  }).catch(() => {
    throw new ApiError('Cannot reach the server. Check your connection.', 0);
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body?.error?.message ?? 'Sign-in failed', res.status);
  const data = body.data;
  if (!data.user?.capabilities?.includes('admin')) {
    await firebaseSignOut(auth()).catch(() => undefined);
    throw new ApiError('This account is not an admin account.', 403);
  }
  tokens.set(data.accessToken, data.refreshToken);
  return data.user as AdminUser;
}

function friendly(error: unknown): never {
  const code = (error as { code?: string }).code ?? '';
  if (error instanceof ApiError) throw error;
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    throw new ApiError('That email and password do not match an account.', 401);
  }
  if (code.includes('too-many-requests')) throw new ApiError('Too many attempts. Wait a few minutes and try again.', 429);
  if (code.includes('popup-closed')) throw new ApiError('The Google window was closed before signing in.', 0);
  throw new ApiError('Sign-in failed. Try again.', 0);
}

export async function signInWithEmail(email: string, password: string): Promise<AdminUser> {
  try {
    const cred = await signInWithEmailAndPassword(auth(), email, password);
    return await exchange(await cred.user.getIdToken());
  } catch (error) {
    friendly(error);
  }
}

export async function signInWithGoogle(): Promise<AdminUser> {
  try {
    const cred = await signInWithPopup(auth(), new GoogleAuthProvider());
    return await exchange(await cred.user.getIdToken());
  } catch (error) {
    friendly(error);
  }
}

/**
 * Emails a password reset link. Firebase does not say whether the address
 * has an account, so the caller shows the same message either way.
 */
export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth(), email.trim());
  } catch (error) {
    const code = (error as { code?: string }).code ?? '';
    if (code.includes('user-not-found')) return;
    if (code.includes('invalid-email')) throw new ApiError('Enter a valid email address.', 422);
    friendly(error);
  }
}

/** The signed-in admin, or null when there is no valid session */
export async function currentAdmin(): Promise<AdminUser | null> {
  if (!tokens.access && !tokens.refresh) return null;
  try {
    const data = await api.get<{ user: AdminUser }>('/auth/me');
    return data.user?.capabilities?.includes('admin') ? data.user : null;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  await api.post('/auth/logout').catch(() => undefined);
  tokens.clear();
  if (firebaseConfigured) await firebaseSignOut(auth()).catch(() => undefined);
}
