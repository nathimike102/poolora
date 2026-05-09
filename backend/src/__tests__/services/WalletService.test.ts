/**
 * Unit tests for WalletService — focusing on:
 * - Atomic deduction (prevent double-spending)
 * - Coin conversion idempotency key fix
 */
import { Types } from 'mongoose';

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockWallet = {
  _id: new Types.ObjectId(),
  userId: new Types.ObjectId().toString(),
  balance: 5000,
  coinBalance: 500,
  lifetimeSpent: 0,
  lifetimeCoinsConverted: 0,
  isLocked: false,
  save: jest.fn(),
};

jest.mock('../../models/Wallet', () => ({
  Wallet: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));

jest.mock('../../models/WalletTransaction', () => ({
  WalletTransaction: {
    create: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
    findOne: jest.fn(),
  },
}));

jest.mock('../../models/CoinLedger', () => ({
  CoinLedger: {
    create: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
  },
}));

jest.mock('../../models/User', () => ({
  User: {
    findById: jest.fn(),
  },
}));

jest.mock('../../events', () => ({
  EventBridge: { publish: jest.fn() },
}));

jest.mock('../../config/redis', () => ({
  getRedisClient: () => null,
}));

// ── Import under test ───────────────────────────────────────────────────────

import { WalletService } from '../../services/WalletService';
import { Wallet } from '../../models/Wallet';
import { WalletTransaction } from '../../models/WalletTransaction';

describe('WalletService — Atomic Deduction', () => {
  let walletService: WalletService;
  const userId = mockWallet.userId;
  const bookingId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    walletService = new WalletService();
  });

  describe('deductForBooking', () => {
    it('should use findOneAndUpdate for atomic deduction', async () => {
      (Wallet.findOne as jest.Mock).mockResolvedValueOnce({
        ...mockWallet,
        isLocked: false,
      });

      // This is the atomic operation — returns the pre-update doc
      (Wallet.findOneAndUpdate as jest.Mock).mockResolvedValueOnce({
        ...mockWallet,
        balance: 5000,
      });

      await walletService.deductForBooking(userId, bookingId, 100);

      // Verify findOneAndUpdate was called with atomic $inc
      expect(Wallet.findOneAndUpdate).toHaveBeenCalledWith(
        { userId, isLocked: false, balance: { $gte: 100 } },
        { $inc: { balance: -100, lifetimeSpent: 100 } },
        { new: false },
      );
    });

    it('should throw INSUFFICIENT_BALANCE when atomic update returns null (concurrent deduction)', async () => {
      (Wallet.findOne as jest.Mock)
        .mockResolvedValueOnce({ ...mockWallet, isLocked: false })  // pre-check
        .mockResolvedValueOnce({ ...mockWallet, balance: 50 });      // re-check for error

      // Atomic update returns null → balance was insufficient at write time
      (Wallet.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(null);

      await expect(walletService.deductForBooking(userId, bookingId, 100)).rejects.toThrow(
        'Insufficient wallet balance',
      );
    });

    it('should throw WALLET_LOCKED when wallet is locked', async () => {
      (Wallet.findOne as jest.Mock).mockResolvedValueOnce({
        ...mockWallet,
        isLocked: true,
      });

      await expect(walletService.deductForBooking(userId, bookingId, 100)).rejects.toThrow(
        'Wallet is locked',
      );

      // Atomic update should NOT have been called
      expect(Wallet.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when wallet does not exist', async () => {
      (Wallet.findOne as jest.Mock).mockResolvedValueOnce(null);

      await expect(walletService.deductForBooking(userId, bookingId, 100)).rejects.toThrow();
      expect(Wallet.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('should record correct balanceBefore and balanceAfter in transaction', async () => {
      const originalBalance = 5000;
      const deductAmount = 250;

      (Wallet.findOne as jest.Mock).mockResolvedValueOnce({
        ...mockWallet,
        balance: originalBalance,
        isLocked: false,
      });

      (Wallet.findOneAndUpdate as jest.Mock).mockResolvedValueOnce({
        ...mockWallet,
        _id: mockWallet._id,
        balance: originalBalance,
      });

      await walletService.deductForBooking(userId, bookingId, deductAmount);

      expect(WalletTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          balanceBefore: originalBalance,
          balanceAfter: originalBalance - deductAmount,
          amount: deductAmount,
          idempotencyKey: `debit_${bookingId}_${userId}`,
        }),
      );
    });
  });
});

describe('WalletService — Coin Conversion Idempotency', () => {
  let walletService: WalletService;
  const userId = mockWallet.userId;

  beforeEach(() => {
    jest.clearAllMocks();
    walletService = new WalletService();
  });

  it('should use a deterministic idempotency key (not Date.now)', async () => {
    (Wallet.findOne as jest.Mock).mockResolvedValueOnce({
      ...mockWallet,
      coinBalance: 500,
      save: jest.fn(),
    });

    // No duplicate found
    (WalletTransaction.findOne as jest.Mock).mockResolvedValueOnce(null);

    await walletService.convertCoinsToBalance(userId, 200);

    // Verify the idempotency key format
    const createCall = (WalletTransaction.create as jest.Mock).mock.calls[0][0];
    expect(createCall.idempotencyKey).toMatch(
      /^coin_convert_.+_200_\d+$/
    );

    // Verify it does NOT contain raw Date.now() (which would be ~13 digits)
    const parts = createCall.idempotencyKey.split('_');
    const timePart = parts[parts.length - 1];
    // The minute-bucket should be shorter than raw Date.now()
    expect(timePart.length).toBeLessThanOrEqual(10);
  });

  it('should reject duplicate conversion within the same minute', async () => {
    (Wallet.findOne as jest.Mock).mockResolvedValueOnce({
      ...mockWallet,
      coinBalance: 500,
    });

    // Existing transaction found = duplicate
    (WalletTransaction.findOne as jest.Mock).mockResolvedValueOnce({
      _id: new Types.ObjectId(),
    });

    const result = await walletService.convertCoinsToBalance(userId, 200);

    // Should return success but NOT create a new transaction
    expect(result).toBeDefined();
    expect(WalletTransaction.create).not.toHaveBeenCalled();
  });
});
