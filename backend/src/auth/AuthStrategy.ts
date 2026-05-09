import { IUser } from '../models/User';

// ─── Auth Provider Enum ──────────────────────────────────────────────────────

export enum AuthProvider {
  FIREBASE = 'firebase',
  CUSTOM = 'custom',
  HYBRID = 'hybrid',
}

// ─── Authentication Result ───────────────────────────────────────────────────

export interface AuthResult {
  /** The resolved database user */
  user: IUser;
  /** Which provider successfully authenticated this request */
  provider: AuthProvider;
  /** Session ID (only relevant for custom JWT sessions) */
  sessionId?: string;
}

// ─── Strategy Interface ──────────────────────────────────────────────────────

export interface AuthStrategy {
  /**
   * Verify a bearer token and return the authenticated user.
   * Throw AuthenticationError if verification fails.
   */
  authenticate(token: string): Promise<AuthResult>;
}
