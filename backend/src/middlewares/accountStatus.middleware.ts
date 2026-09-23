import { Request, Response, NextFunction } from 'express';
import { User, IUser } from '../models/User';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../types';

/**
 * A blocked account cannot use the API at all. A suspended one can still
 * sign in and see its rides, but not post or book (UC-A05). Suspensions
 * with an end date lift themselves once it passes.
 *
 * Returns the account's status, or throws for a blocked account.
 */
export async function checkAccountStatus(user: IUser): Promise<'active' | 'suspended'> {
  if (user.isBlocked) {
    throw new AppError('This account has been blocked. Contact support if you think this is a mistake.', 403, 'ACCOUNT_BLOCKED');
  }
  if (!user.isSuspended) return 'active';
  if (user.suspendedUntil && user.suspendedUntil.getTime() <= Date.now()) {
    await User.updateOne({ _id: user._id }, { $set: { isSuspended: false }, $unset: { suspendedUntil: 1 } });
    return 'active';
  }
  return 'suspended';
}

/** Put on routes that post or book rides: suspended accounts cannot. */
export function requireActiveAccount(req: Request, _res: Response, next: NextFunction): void {
  const { user } = req as AuthenticatedRequest;
  if (user?.accountStatus === 'suspended') {
    const until = user.suspendedUntil
      ? ` until ${user.suspendedUntil.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`
      : '';
    next(new AppError(`Your account is suspended${until}, so you cannot post or book rides.`, 403, 'ACCOUNT_SUSPENDED'));
    return;
  }
  next();
}
