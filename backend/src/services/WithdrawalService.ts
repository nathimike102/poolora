/**
 * WithdrawalService.ts
 *
 * Cashing out the wallet to EcoCash, OneMoney or InnBucks. Drivers are paid
 * into their wallet, and online payments that are refunded come back to it
 * (Paynow has no refund API), so this is how money leaves Siham.
 *
 * The amount leaves the wallet when the request is made, so it cannot be
 * spent twice. An admin sends it from the business mobile money account and
 * marks the request paid with the transaction id, or rejects it and the
 * amount goes back to the wallet. The user can cancel while it is pending.
 */

import { Types } from 'mongoose';
import { Wallet } from '../models/Wallet';
import { WalletTransaction } from '../models/WalletTransaction';
import { WithdrawalRequest, IWithdrawalRequest } from '../models/WithdrawalRequest';
import { WalletTransactionStatus, WalletTransactionType } from '../types';
import { money, toE164 } from '../config/region';
import { AppError, NotFoundError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { WalletService } from './WalletService';
import { NotificationService } from './NotificationService';
import { audit } from './AuditService';
import { phrase } from '../i18n';

export const WITHDRAWAL_RULES = { min: 2, max: 1000 } as const;
const CHANNELS = ['ecocash', 'onemoney', 'innbucks'] as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** EcoCash is on Econet (077, 078) and OneMoney on NetOne (071); InnBucks takes any number */
export function channelFits(channel: string, e164: string): boolean {
  if (channel === 'ecocash') return /^\+2637[78]/.test(e164);
  if (channel === 'onemoney') return /^\+26371/.test(e164);
  return true;
}

const LABEL: Record<string, string> = { ecocash: 'EcoCash', onemoney: 'OneMoney', innbucks: 'InnBucks' };

export class WithdrawalService {
  private wallet = new WalletService();
  private notifications = new NotificationService();

  async request(userId: string, input: { amount: number; channel: string; payNumber: string }): Promise<IWithdrawalRequest> {
    const amount = round2(Number(input.amount));
    // Refunds land in the wallet (Paynow cannot refund) and a seat can cost
    // US$1, so a balance under the minimum can always be withdrawn in full;
    // otherwise that money could never leave, and the account could not close
    const balance = round2((await Wallet.findOne({ userId }).select('balance').lean())?.balance ?? 0);
    const wholeSmallBalance = amount > 0 && amount === balance && balance < WITHDRAWAL_RULES.min;
    if (!(amount >= WITHDRAWAL_RULES.min || wholeSmallBalance) || amount > WITHDRAWAL_RULES.max) {
      throw new AppError(`You can withdraw between ${money(WITHDRAWAL_RULES.min)} and ${money(WITHDRAWAL_RULES.max)} at a time, or all of a smaller balance.`, 422, 'VALIDATION_ERROR');
    }
    if (!(CHANNELS as readonly string[]).includes(input.channel)) throw new AppError('Choose EcoCash, OneMoney or InnBucks', 422, 'VALIDATION_ERROR');
    const payNumber = toE164(input.payNumber);
    if (!payNumber) throw new AppError('Enter a Zimbabwe mobile number, like 0771 234 567', 422, 'VALIDATION_ERROR');
    if (!channelFits(input.channel, payNumber)) {
      throw new AppError(`That number is not on ${LABEL[input.channel]}. EcoCash numbers start 077 or 078, OneMoney 071.`, 422, 'VALIDATION_ERROR');
    }
    if (await WithdrawalRequest.exists({ user: userId, status: 'pending' })) {
      throw new AppError('You already have a withdrawal waiting to be paid. Cancel it first to change it.', 409, 'WITHDRAWAL_PENDING');
    }

    const request = await WithdrawalRequest.create({ user: userId, amount, channel: input.channel, payNumber });
    const before = await Wallet.findOneAndUpdate(
      { userId, isLocked: false, balance: { $gte: amount } },
      { $inc: { balance: -amount } },
      { new: false },
    );
    if (!before) {
      await WithdrawalRequest.deleteOne({ _id: request._id });
      const wallet = await Wallet.findOne({ userId });
      if (wallet?.isLocked) throw new AppError('Wallet is locked. Please contact support.', 403, 'WALLET_LOCKED');
      throw new AppError(`Your wallet has ${money(wallet?.balance ?? 0)}; you cannot withdraw ${money(amount)}.`, 402, 'INSUFFICIENT_BALANCE');
    }
    await WalletTransaction.create({
      wallet: before._id,
      userId,
      type: WalletTransactionType.WITHDRAWAL,
      amount,
      balanceBefore: round2(before.balance),
      balanceAfter: round2(before.balance - amount),
      status: WalletTransactionStatus.COMPLETED,
      description: `Withdrawal to ${LABEL[input.channel]} ${payNumber}`,
      idempotencyKey: `withdraw_${request._id}`,
    });
    logger.info('Withdrawal requested', { userId, amount, channel: input.channel, requestId: request._id.toString() });
    return request;
  }

  mine(userId: string) {
    return WithdrawalRequest.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean();
  }

  async cancel(userId: string, id: string): Promise<IWithdrawalRequest> {
    const request = await this.settle(id, { user: new Types.ObjectId(userId) }, { status: 'cancelled' });
    await this.wallet.credit(userId, request.amount, 'Withdrawal cancelled', `withdraw_back_${request._id}`);
    return request;
  }

  adminList(status = 'pending') {
    const filter = status === 'all' ? {} : { status };
    return WithdrawalRequest.find(filter).sort({ createdAt: 1 }).limit(200).populate('user', 'name phone email').lean();
  }

  /** The admin has sent the money */
  async markPaid(id: string, adminId: string, payoutReference: string): Promise<IWithdrawalRequest> {
    const reference = String(payoutReference ?? '').trim();
    if (reference.length < 4) throw new AppError('Enter the transaction id of the payout', 422, 'VALIDATION_ERROR');
    const request = await this.settle(id, {}, { status: 'paid', payoutReference: reference.slice(0, 100), processedBy: adminId, processedAt: new Date() });
    await audit(adminId, 'withdrawal.paid', 'withdrawal', id, undefined, { amount: request.amount, payoutReference: reference });
    await this.notifications
      .createNotification(request.user.toString(), phrase('withdrawal.sentTitle'), phrase('withdrawal.sentBody', { amount: money(request.amount), wallet: LABEL[request.channel], number: request.payNumber, reference }), 'system', { withdrawalId: id })
      .catch(() => undefined);
    return request;
  }

  /** The payout will not be made; the amount goes back to the wallet */
  async reject(id: string, adminId: string, note: string): Promise<IWithdrawalRequest> {
    const reason = String(note ?? '').trim();
    if (reason.length < 5) throw new AppError('Say why, so the user knows what to fix', 422, 'VALIDATION_ERROR');
    const request = await this.settle(id, {}, { status: 'rejected', note: reason.slice(0, 500), processedBy: adminId, processedAt: new Date() });
    await this.wallet.credit(request.user.toString(), request.amount, 'Withdrawal returned', `withdraw_back_${request._id}`);
    await audit(adminId, 'withdrawal.reject', 'withdrawal', id, reason, { amount: request.amount });
    await this.notifications
      .createNotification(request.user.toString(), phrase('withdrawal.returnedTitle'), phrase('withdrawal.returnedBody', { amount: money(request.amount), reason }), 'system', { withdrawalId: id })
      .catch(() => undefined);
    return request;
  }

  /** Moves a pending request on, once: a second attempt finds it no longer pending */
  private async settle(id: string, scope: Record<string, unknown>, set: Record<string, unknown>): Promise<IWithdrawalRequest> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Withdrawal');
    const request = await WithdrawalRequest.findOneAndUpdate({ _id: id, status: 'pending', ...scope }, { $set: set }, { new: true });
    if (request) return request;
    if (await WithdrawalRequest.exists({ _id: id, ...scope })) throw new AppError('This withdrawal has already been dealt with', 409, 'WITHDRAWAL_SETTLED');
    throw new NotFoundError('Withdrawal');
  }
}
