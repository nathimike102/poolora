export { AuthStrategy, AuthResult, AuthProvider } from './AuthStrategy';
export { UnifiedAuthService } from './UnifiedAuthService';
export { FirebaseAuthStrategy } from './strategies/FirebaseAuthStrategy';
export { JwtAuthStrategy } from './strategies/JwtAuthStrategy';

import { UnifiedAuthService } from './UnifiedAuthService';

/** Shared singleton — avoids duplicate initialisation at import time. */
export const unifiedAuth = new UnifiedAuthService();
