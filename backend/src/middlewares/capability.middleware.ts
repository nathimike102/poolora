import { Request, Response, NextFunction } from 'express';
import { AuthorizationError, AuthenticationError } from '../utils/AppError';
import { UserCapability, AuthenticatedRequest } from '../types';

/**
 * Capability-based authorization. Checks if the authenticated user
 * possesses the required capabilities. NOT old-style role checks.
 */
export function requireCapability(...required: UserCapability[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      next(new AuthenticationError());
      return;
    }

    const hasAll = required.every((cap) => user.capabilities.includes(cap));

    if (!hasAll) {
      next(
        new AuthorizationError(
          `Missing required capabilities: ${required.join(', ')}`,
        ),
      );
      return;
    }

    next();
  };
}

/**
 * Checks that the user has driverVerified flag set to true.
 * This is separate from having the DRIVER capability — the user
 * must also have passed KYC review.
 */
export function requireDriverVerification() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      next(new AuthenticationError());
      return;
    }

    if (!user.capabilities.includes(UserCapability.DRIVER)) {
      next(new AuthorizationError('Driver capability required'));
      return;
    }

    if (!user.driverVerified) {
      next(
        new AuthorizationError(
          'Driver verification pending. Your KYC documents must be approved before you can create rides.',
        ),
      );
      return;
    }

    next();
  };
}

/**
 * Admin-only access.
 */
export function requireAdmin() {
  return requireCapability(UserCapability.ADMIN);
}
