import { AuthResult, AuthProvider } from './AuthStrategy';
import { FirebaseAuthStrategy } from './strategies/FirebaseAuthStrategy';
import { JwtAuthStrategy } from './strategies/JwtAuthStrategy';
import { AuthenticationError } from '../utils/AppError';
import { logger } from '../utils/logger';

/**
 * Resolves the configured AUTH_PROVIDER env to: 'firebase' | 'custom' | 'hybrid'
 */
function resolveProvider(): AuthProvider {
  const raw = (process.env.AUTH_PROVIDER || 'hybrid').toLowerCase().trim();
  if (Object.values(AuthProvider).includes(raw as AuthProvider)) {
    return raw as AuthProvider;
  }
  logger.warn(`Unknown AUTH_PROVIDER "${raw}" — defaulting to hybrid`);
  return AuthProvider.HYBRID;
}

/**
 * Unified authentication facade.
 *
 * ┌─────────┐
 * │ Request │──→ Bearer token
 * └────┬────┘
 *      │
 *      ▼
 *  ┌───────────────┐
 *  │   Unified     │
 *  │  AuthService  │
 *  └───────┬───────┘
 *          │
 *    ┌─────┴──────┐
 *    │ AUTH_PROVIDER│
 *    └─────┬──────┘
 *          │
 *  firebase│ custom │ hybrid
 *   ┌──────┼────────┼───────┐
 *   ▼      ▼        ▼       │
 * Firebase JWT    Firebase → │
 *  only   only    then JWT   │
 *                   fallback │
 */
export class UnifiedAuthService {
  private readonly firebaseStrategy: FirebaseAuthStrategy;
  private readonly jwtStrategy: JwtAuthStrategy;
  private readonly provider: AuthProvider;

  constructor() {
    this.firebaseStrategy = new FirebaseAuthStrategy();
    this.jwtStrategy = new JwtAuthStrategy();
    this.provider = resolveProvider();

    logger.info(`UnifiedAuthService initialized with provider: ${this.provider}`);
  }

  /**
   * Authenticate a bearer token using the configured strategy.
   */
  async authenticate(token: string): Promise<AuthResult> {
    switch (this.provider) {
      case AuthProvider.FIREBASE:
        return this.authenticateFirebase(token);

      case AuthProvider.CUSTOM:
        return this.authenticateJwt(token);

      case AuthProvider.HYBRID:
      default:
        return this.authenticateHybrid(token);
    }
  }

  // ─── Private strategy dispatchers ──────────────────────────────────────

  private async authenticateFirebase(token: string): Promise<AuthResult> {
    return this.firebaseStrategy.authenticate(token);
  }

  private async authenticateJwt(token: string): Promise<AuthResult> {
    return this.jwtStrategy.authenticate(token);
  }

  /**
   * Hybrid: try Firebase first, fall back to custom JWT.
   *
   * Why not the other way around?
   * - The React Native client sends Firebase ID tokens as the primary flow.
   * - jwt.verify() on a Firebase token would fail anyway (different secret),
   *   so trying Firebase first avoids an unnecessary failure.
   */
  private async authenticateHybrid(token: string): Promise<AuthResult> {
    try {
      return await this.firebaseStrategy.authenticate(token);
    } catch (firebaseErr) {
      logger.debug('Firebase auth failed — falling back to JWT', {
        reason: (firebaseErr as Error).message,
      });
    }

    try {
      return await this.jwtStrategy.authenticate(token);
    } catch (_jwtErr) {
      // Both strategies failed — throw a combined error
      throw new AuthenticationError(
        'Authentication failed. Token is not a valid Firebase ID token or custom JWT.',
      );
    }
  }
}
