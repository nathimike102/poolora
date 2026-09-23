/**
 * Blocked accounts are shut out; suspended ones can read but not post or
 * book, until the suspension ends (UC-A05). Fraud blocks used to be written
 * to the user and never checked.
 */
jest.mock('../../models/User', () => ({ User: { updateOne: jest.fn() } }));

import { Types } from 'mongoose';
import { User } from '../../models/User';
import { checkAccountStatus, requireActiveAccount } from '../../middlewares/accountStatus.middleware';
import type { IUser } from '../../models/User';

const user = (fields: Partial<IUser>) => ({ _id: new Types.ObjectId(), isBlocked: false, isSuspended: false, ...fields }) as IUser;

describe('checkAccountStatus', () => {
  it('rejects a blocked account', async () => {
    await expect(checkAccountStatus(user({ isBlocked: true }))).rejects.toMatchObject({ statusCode: 403, errorId: 'ACCOUNT_BLOCKED' });
  });

  it('reports a suspension that has not ended', async () => {
    const until = new Date(Date.now() + 86_400_000);
    await expect(checkAccountStatus(user({ isSuspended: true, suspendedUntil: until }))).resolves.toBe('suspended');
  });

  it('treats a suspension with no end date as ongoing', async () => {
    await expect(checkAccountStatus(user({ isSuspended: true }))).resolves.toBe('suspended');
  });

  it('lifts a suspension whose end date has passed', async () => {
    const u = user({ isSuspended: true, suspendedUntil: new Date(Date.now() - 1000) });
    await expect(checkAccountStatus(u)).resolves.toBe('active');
    expect(User.updateOne).toHaveBeenCalledWith({ _id: u._id }, { $set: { isSuspended: false }, $unset: { suspendedUntil: 1 } });
  });
});

describe('requireActiveAccount', () => {
  it('stops a suspended account from posting or booking', () => {
    const next = jest.fn();
    requireActiveAccount({ user: { accountStatus: 'suspended' } } as never, {} as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, errorId: 'ACCOUNT_SUSPENDED' }));
  });

  it('lets an active account through', () => {
    const next = jest.fn();
    requireActiveAccount({ user: { accountStatus: 'active' } } as never, {} as never, next);
    expect(next).toHaveBeenCalledWith();
  });
});
