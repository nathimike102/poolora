/**
 * Unit tests for WalletService.confirmTopUp — focusing on:
 * - A payment can only be credited once (including concurrent confirms)
 * - A payment can only be credited to the wallet that created the order
 */
import crypto from 'crypto';
import { Types } from 'mongoose';

const mockOrdersFetch = jest.fn();
const mockPaymentsFetch = jest.fn();

jest.mock('razorpay', () =>
  jest.fn().mockImplementation(() => ({
    orders: { fetch: mockOrdersFetch, create: jest.fn() },
    payments: { fetch: mockPaymentsFetch },
  })),
);
jest.mock('../../models/Wallet', () => ({
  Wallet: { findOne: jest.fn(), findOneAndUpdate: jest.fn(), findById: jest.fn() },
}));
jest.mock('../../models/WalletTransaction', () => ({
  WalletTransaction: { create: jest.fn(), findOne: jest.fn() },
}));
jest.mock('../../models/CoinLedger', () => ({ CoinLedger: { create: jest.fn() } }));
jest.mock('../../models/User', () => ({ User: { findById: jest.fn() } }));
jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
jest.mock('../../config/redis', () => ({ getRedisClient: () => null }));

import { WalletService } from '../../services/WalletService';
import { Wallet } from '../../models/Wallet';
import { WalletTransaction } from '../../models/WalletTransaction';
import { WalletTransactionStatus } from '../../types';

const service = new WalletService();
const USER_ID = new Types.ObjectId().toString();
const WALLET_ID = new Types.ObjectId();
const ORDER_ID = 'order_abc';
const PAYMENT_ID = 'pay_xyz';

function sign(orderId: string, paymentId: string): string {
  return crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET as string)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

function claimedTransaction() {
  return {
    userId: USER_ID,
    wallet: WALLET_ID,
    status: WalletTransactionStatus.PENDING,
    balanceBefore: 0,
    balanceAfter: 0,
    save: jest.fn().mockResolvedValue(true),
  };
}

describe('WalletService.confirmTopUp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOrdersFetch.mockResolvedValue({ amount: 50000, notes: { userId: USER_ID, purpose: 'wallet_topup' } });
    mockPaymentsFetch.mockResolvedValue({ order_id: ORDER_ID, status: 'captured' });
    (WalletTransaction.findOne as jest.Mock).mockResolvedValue(null);
    (Wallet.findOne as jest.Mock).mockResolvedValue({ _id: WALLET_ID, balance: 100, isLocked: false });
    (Wallet.findById as jest.Mock).mockResolvedValue({ _id: WALLET_ID, balance: 600 });
  });

  it('credits the wallet atomically and completes the transaction', async () => {
    const tx = claimedTransaction();
    (WalletTransaction.create as jest.Mock).mockResolvedValue(tx);
    (Wallet.findOneAndUpdate as jest.Mock).mockResolvedValue({ _id: WALLET_ID, balance: 100 });

    const result = await service.confirmTopUp(USER_ID, ORDER_ID, PAYMENT_ID, sign(ORDER_ID, PAYMENT_ID));

    expect(Wallet.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: WALLET_ID, isLocked: false }),
      { $inc: { balance: 500, lifetimeTopUp: 500 } },
      { new: false },
    );
    expect(tx.status).toBe(WalletTransactionStatus.COMPLETED);
    expect(tx.balanceBefore).toBe(100);
    expect(tx.balanceAfter).toBe(600);
    expect(result.wallet).toEqual({ _id: WALLET_ID, balance: 600 });
  });

  it('rejects an invalid signature, including malformed input', async () => {
    await expect(service.confirmTopUp(USER_ID, ORDER_ID, PAYMENT_ID, 'not-hex')).rejects.toThrow(
      'Invalid payment signature',
    );
    await expect(
      service.confirmTopUp(USER_ID, ORDER_ID, PAYMENT_ID, 'z'.repeat(64)),
    ).rejects.toThrow('Invalid payment signature');
    expect(Wallet.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('does not credit a payment made for another user', async () => {
    mockOrdersFetch.mockResolvedValue({
      amount: 50000,
      notes: { userId: new Types.ObjectId().toString(), purpose: 'wallet_topup' },
    });

    await expect(
      service.confirmTopUp(USER_ID, ORDER_ID, PAYMENT_ID, sign(ORDER_ID, PAYMENT_ID)),
    ).rejects.toThrow('does not belong to your wallet');
    expect(WalletTransaction.create).not.toHaveBeenCalled();
  });

  it('does not credit a payment that was not captured', async () => {
    mockPaymentsFetch.mockResolvedValue({ order_id: ORDER_ID, status: 'authorized' });

    await expect(
      service.confirmTopUp(USER_ID, ORDER_ID, PAYMENT_ID, sign(ORDER_ID, PAYMENT_ID)),
    ).rejects.toThrow('Payment has not been captured');
  });

  it('returns the existing transaction for a repeated confirm without crediting again', async () => {
    const done = { ...claimedTransaction(), status: WalletTransactionStatus.COMPLETED };
    (WalletTransaction.findOne as jest.Mock).mockResolvedValue(done);

    const result = await service.confirmTopUp(USER_ID, ORDER_ID, PAYMENT_ID, sign(ORDER_ID, PAYMENT_ID));

    expect(result.transaction).toBe(done);
    expect(Wallet.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('does not credit when a concurrent confirm already claimed the payment', async () => {
    (WalletTransaction.findOne as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(claimedTransaction());
    (WalletTransaction.create as jest.Mock).mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));

    await expect(
      service.confirmTopUp(USER_ID, ORDER_ID, PAYMENT_ID, sign(ORDER_ID, PAYMENT_ID)),
    ).rejects.toThrow('already being processed');
    expect(Wallet.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('marks the transaction failed when the credit would exceed the balance limit', async () => {
    const tx = claimedTransaction();
    (WalletTransaction.create as jest.Mock).mockResolvedValue(tx);
    (Wallet.findOneAndUpdate as jest.Mock).mockResolvedValue(null);

    await expect(
      service.confirmTopUp(USER_ID, ORDER_ID, PAYMENT_ID, sign(ORDER_ID, PAYMENT_ID)),
    ).rejects.toThrow('maximum wallet balance');
    expect(tx.status).toBe(WalletTransactionStatus.FAILED);
  });
});
