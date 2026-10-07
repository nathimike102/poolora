import { Request, Response, NextFunction } from 'express';
import { User, IUser } from '../models/User';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../types';
import { localTime } from '../config/region';

/**
 * A blocked account cannot use the API at all. A suspended one can still
 * sign in and see its rides, but not post or book (UC-A05). Suspensions
 * with an end date lift themselves once it passes.
 *
 * Returns the account's status, or throws for a blocked account.
 */
export async function checkAccountStatus(user: IUser, opts: { allowBlocked?: boolean } = {}): Promise<'active' | 'suspended' | 'blocked'> {
  if (user.isBlocked) {
    if (user.mergedInto) {
      throw new AppError(`This account was merged into your other Siham account. ${user.blockReason?.match(/phone ending \d{4}/) ? `Sign in with the ${user.blockReason.match(/phone ending \d{4}/)![0].replace('phone', 'number')}.` : ''}`.trim(), 403, 'ACCOUNT_MERGED');
    }
    // A blocked account can still read its status and appeal (UC-A05 3a)
    if (opts.allowBlocked) return 'blocked';
    throw new AppError('This account has been blocked. You can appeal from the app within 30 days.', 403, 'ACCOUNT_BLOCKED');
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
      ? ` until ${localTime(user.suspendedUntil, { day: 'numeric', month: 'long', year: 'numeric' })}`
      : '';
    next(new AppError(`Your account is suspended${until}, so you cannot post or book rides.`, 403, 'ACCOUNT_SUSPENDED'));
    return;
  }
  next();
}
