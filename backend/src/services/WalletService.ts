import crypto from 'crypto';

import Razorpay from 'razorpay';
import { Wallet, IWallet } from '../models/Wallet';
import { WalletTransaction } from '../models/WalletTransaction';
import { CoinLedger } from '../models/CoinLedger';
import { config } from '../config';
import {
    WalletTransactionType,
    WalletTransactionStatus,
    CoinTransactionType,
} from '../types';
import {
    AppError,
    NotFoundError,
    AuthorizationError,
} from '../utils/AppError';
import { paginate } from '../utils/helpers';
import { EventBridge } from '../events';
import { logger } from '../utils/logger';
import { RewardService } from './RewardService';

const rewardService = new RewardService();

function hasPlaceholderCredential(value?: string): boolean {
    if (!value) return true;
    return (
        value.includes('CHANGE_ME') ||
        value.includes('XXXXXXXX') ||
        value.includes('your_') ||
        value.includes('dummy_')
    );
}

function isRazorpayConfigured(): boolean {
    const keyId = config.razorpay.keyId;
    const keySecret = config.razorpay.keySecret;
    return Boolean(keyId && keySecret && !hasPlaceholderCredential(keyId) && !hasPlaceholderCredential(keySecret));
}

// Razorpay instance (re-uses existing credentials from config, fallback to prevent boot crash if missing)
const razorpay = new Razorpay({
    key_id: config.razorpay.keyId || 'dummy_key_id',
    key_secret: config.razorpay.keySecret || 'dummy_key_secret',
});

export class WalletService {
    // ── Internal helpers ────────────────────────────────────────────────────────

    /**
     * Fetches the wallet for userId. Creates one if it doesn't exist yet.
     */
    async getOrCreateWallet(userId: string): Promise<IWallet> {
        const wallet = await Wallet.findOneAndUpdate(
            { userId },
            { $setOnInsert: { userId } },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        return wallet!;
    }

    // ── Balance ─────────────────────────────────────────────────────────────────

    /**
     * Returns the current wallet state (balance, coins, tier, benefits).
     */
    async getBalance(userId: string) {
        const wallet = await this.getOrCreateWallet(userId);
        const benefits = rewardService.getTierBenefits(wallet.tier);
        return { wallet, benefits };
    }

    // ── Top-up ──────────────────────────────────────────────────────────────────

    /**
     * Creates a Razorpay order for adding money to the wallet.
     */
    async createTopUpOrder(userId: string, amount: number) {
        const { minTopUpAmount, maxTopUpAmount } = config.wallet;
        if (amount < minTopUpAmount || amount > maxTopUpAmount) {
            throw new AppError(
                `Top-up amount must be between ₹${minTopUpAmount} and ₹${maxTopUpAmount}`,
                400,
                'INVALID_AMOUNT',
            );
        }

        const wallet = await this.getOrCreateWallet(userId);
        if (wallet.isLocked) {
            throw new AppError('Wallet is locked. Please contact support.', 403, 'WALLET_LOCKED');
        }

        // In dev/test when Razorpay keys are not configured, return a mock order
        if (!isRazorpayConfigured()) {
            const mockOrderId = `order_mock_${Date.now()}`;
            logger.warn('Razorpay keys not configured — returning mock order', { userId, amount, mockOrderId });
            return {
                razorpayOrderId: mockOrderId,
                amount,
                currency: 'INR',
                keyId: 'rzp_test_mock',
            };
        }

        const order = await razorpay.orders.create({
            amount: Math.round(amount * 100), // paise
            currency: 'INR',
            receipt: `wallet_${userId}_${Date.now()}`,
            notes: { userId, purpose: 'wallet_topup' },
        });

        logger.info('Wallet top-up order created', { userId, amount, orderId: order.id });

        return {
            razorpayOrderId: order.id,
            amount,
            currency: 'INR',
            keyId: config.razorpay.keyId,
        };
    }

    /**
     * Verifies Razorpay payment and credits the wallet.
     * Idempotent — safe to call multiple times for the same payment.
     */
    async confirmTopUp(
        userId: string,
        razorpayOrderId: string,
        razorpayPaymentId: string,
        razorpaySignature: string,
    ) {
        // 1. Verify signature
        const expectedSignature = crypto
            .createHmac('sha256', config.razorpay.keySecret)
            .update(`${razorpayOrderId}|${razorpayPaymentId}`)
            .digest('hex');

        if (
            razorpaySignature.length !== expectedSignature.length ||
            !crypto.timingSafeEqual(
                Buffer.from(razorpaySignature, 'hex'),
                Buffer.from(expectedSignature, 'hex'),
            )
        ) {
            throw new AppError('Invalid payment signature', 401, 'INVALID_SIGNATURE');
        }

        // 2. Idempotency — if already processed, return existing transaction
        const existing = await WalletTransaction.findOne({
            idempotencyKey: `topup_${razorpayPaymentId}`,
        });
        if (existing) {
            logger.info('Duplicate top-up confirmation ignored', { razorpayPaymentId });
            const wallet = await Wallet.findById(existing.wallet);
            return { transaction: existing, wallet };
        }

        const wallet = await Wallet.findOne({ userId });
        if (!wallet) throw new NotFoundError('Wallet');
        if (wallet.isLocked) {
            throw new AppError('Wallet is locked', 403, 'WALLET_LOCKED');
        }

        // Fetch order amount from Razorpay
        const order = await razorpay.orders.fetch(razorpayOrderId);
        const amountInr = (order.amount as number) / 100;

        if (wallet.balance + amountInr > config.wallet.maxWalletBalance) {
            throw new AppError(
                `Top-up would exceed maximum wallet balance of ₹${config.wallet.maxWalletBalance}`,
                400,
                'BALANCE_LIMIT_EXCEEDED',
            );
        }

        const balanceBefore = wallet.balance;
        wallet.balance += amountInr;
        wallet.lifetimeTopUp += amountInr;
        await wallet.save();

        const transaction = await WalletTransaction.create({
            wallet: wallet._id,
            userId,
            type: WalletTransactionType.TOPUP,
            amount: amountInr,
            balanceBefore,
            balanceAfter: wallet.balance,
            status: WalletTransactionStatus.COMPLETED,
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            description: `Wallet top-up of ₹${amountInr}`,
            idempotencyKey: `topup_${razorpayPaymentId}`,
        });

        EventBridge.publish('payment-events', {
            eventType: 'wallet.topup.completed',
            data: { userId, amount: amountInr, walletBalance: wallet.balance },
        });

        logger.info('Wallet top-up confirmed', { userId, amountInr, razorpayPaymentId });
        return { transaction, wallet };
    }

    // ── Deduct (used internally by BookingService) ────────────────────────────

    /**
     * Atomically deducts `amount` from the wallet balance for a booking payment.
     */
    async deductForBooking(
        userId: string,
        bookingId: string,
        amount: number,
    ): Promise<void> {
        // Pre-check for user-friendly error messages
        const existingWallet = await Wallet.findOne({ userId });
        if (!existingWallet) throw new NotFoundError('Wallet');
        if (existingWallet.isLocked) throw new AppError('Wallet is locked', 403, 'WALLET_LOCKED');

        // Atomic deduction — prevents double-spending under concurrent requests.
        // The query condition `balance: { $gte: amount }` ensures the write only
        // succeeds when sufficient funds exist, and `$inc: -amount` is applied
        // atomically by MongoDB.
        const wallet = await Wallet.findOneAndUpdate(
            { userId, isLocked: false, balance: { $gte: amount } },
            { $inc: { balance: -amount, lifetimeSpent: amount } },
            { new: false }, // return pre-update doc for balanceBefore
        );

        if (!wallet) {
            // Re-check to give a specific error
            const current = await Wallet.findOne({ userId });
            if (!current) throw new NotFoundError('Wallet');
            throw new AppError(
                `Insufficient wallet balance. Have ₹${current.balance.toFixed(2)}, need ₹${amount.toFixed(2)}`,
                402,
                'INSUFFICIENT_BALANCE',
            );
        }

        await WalletTransaction.create({
            wallet: wallet._id,
            userId,
            type: WalletTransactionType.DEBIT,
            amount,
            balanceBefore: wallet.balance,
            balanceAfter: wallet.balance - amount,
            status: WalletTransactionStatus.COMPLETED,
            bookingId,
            description: `Ride payment for booking ${bookingId}`,
            idempotencyKey: `debit_${bookingId}_${userId}`,
        });
    }

    // ── Refund ──────────────────────────────────────────────────────────────────

    /**
     * Refunds a deducted wallet amount (e.g., on booking cancellation).
     * Idempotent by idempotencyKey.
     */
    async refundToWallet(
        userId: string,
        bookingId: string,
        amount: number,
        reason: string,
    ): Promise<void> {
        const idempotencyKey = `refund_${bookingId}_${userId}`;
        const existing = await WalletTransaction.findOne({ idempotencyKey });
        if (existing) {
            logger.info('Duplicate wallet refund ignored', { bookingId, userId });
            return;
        }

        const wallet = await Wallet.findOne({ userId });
        if (!wallet) throw new NotFoundError('Wallet');

        const balanceBefore = wallet.balance;
        wallet.balance += amount;
        await wallet.save();

        await WalletTransaction.create({
            wallet: wallet._id,
            userId,
            type: WalletTransactionType.REFUND,
            amount,
            balanceBefore,
            balanceAfter: wallet.balance,
            status: WalletTransactionStatus.COMPLETED,
            bookingId,
            description: `Refund for booking ${bookingId}: ${reason}`,
            idempotencyKey,
        });

        EventBridge.publish('payment-events', {
            eventType: 'wallet.refund.completed',
            data: { userId, bookingId, amount },
        });
    }

    // ── Coin award (called after ride completion) ─────────────────────────────

    /**
     * Awards coins to a user based on their tier and the fare amount.
     * Safe to call outside transactions — failure never breaks the booking flow.
     */
    async awardCoinsForRide(
        userId: string,
        bookingId: string,
        fareAmount: number,
    ): Promise<void> {
        try {
            const wallet = await this.getOrCreateWallet(userId);
            if (wallet.isLocked) return;

            const coinsEarned = rewardService.computeCoinsForFare(fareAmount, wallet.tier);
            if (coinsEarned <= 0) return;

            const balanceBefore = wallet.coinBalance;
            const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

            wallet.coinBalance += coinsEarned;
            wallet.lifetimeCoinsEarned += coinsEarned;
            wallet.totalRidesCompleted += 1;
            await wallet.save();

            await CoinLedger.create({
                wallet: wallet._id,
                userId,
                type: CoinTransactionType.EARNED,
                coins: coinsEarned,
                balanceBefore,
                balanceAfter: wallet.coinBalance,
                bookingId,
                description: `Earned ${coinsEarned} coins from ride (${wallet.tier} tier, ₹${fareAmount})`,
                expiresAt,
            });

            // Check tier upgrade after incrementing rides
            await rewardService.checkAndUpgradeTier(wallet);

            EventBridge.publish('user-events', {
                eventType: 'wallet.coins.earned',
                data: { userId, bookingId, coinsEarned, newCoinBalance: wallet.coinBalance },
            });

            logger.info('Coins awarded for ride', { userId, bookingId, coinsEarned });
        } catch (error) {
            // Non-fatal: coin award failure should not break booking completion
            logger.error('Failed to award coins for ride', { userId, bookingId, error });
        }
    }

    // ── Coin conversion ──────────────────────────────────────────────────────

    /**
     * Converts coins to INR wallet balance.
     * Rate: config.wallet.coinToInrRate (default ₹0.25 per coin).
     * Minimum: config.wallet.minCoinConversion coins.
     */
    async convertCoinsToBalance(userId: string, coins: number) {
        const { coinToInrRate, minCoinConversion, maxWalletBalance } = config.wallet;

        if (!Number.isInteger(coins) || coins < minCoinConversion) {
            throw new AppError(
                `Minimum ${minCoinConversion} coins required for conversion`,
                400,
                'INSUFFICIENT_COINS',
            );
        }

        const wallet = await Wallet.findOne({ userId });
        if (!wallet) throw new NotFoundError('Wallet');
        if (wallet.isLocked) throw new AppError('Wallet is locked', 403, 'WALLET_LOCKED');

        if (wallet.coinBalance < coins) {
            throw new AppError(
                `Insufficient coin balance. Have ${wallet.coinBalance}, need ${coins}`,
                402,
                'INSUFFICIENT_COINS',
            );
        }

        const amountToCredit = Math.round(coins * coinToInrRate * 100) / 100;

        if (wallet.balance + amountToCredit > maxWalletBalance) {
            throw new AppError(
                `Conversion would exceed maximum wallet balance of ₹${maxWalletBalance}`,
                400,
                'BALANCE_LIMIT_EXCEEDED',
            );
        }

        // Deterministic idempotency key — prevents duplicate conversion in short window
        const idempotencyKey = `coin_convert_${userId}_${coins}_${Math.floor(Date.now() / 60000)}`;

        // Check upfront to prevent duplicate processing
        const existingTx = await WalletTransaction.findOne({ idempotencyKey });
        if (existingTx) {
            logger.info('Duplicate coin conversion ignored', { userId, coins });
            return {
                coinsConverted: coins,
                amountCredited: amountToCredit,
                newBalance: wallet.balance,
                newCoinBalance: wallet.coinBalance,
            };
        }

        // Deduct coins
        const coinsBefore = wallet.coinBalance;
        wallet.coinBalance -= coins;
        wallet.lifetimeCoinsConverted += coins;

        // Credit INR
        const balanceBefore = wallet.balance;
        wallet.balance += amountToCredit;
        await wallet.save();

        // Create INR wallet transaction
        const walletTx = await WalletTransaction.create({
            wallet: wallet._id,
            userId,
            type: WalletTransactionType.COIN_CONVERSION,
            amount: amountToCredit,
            balanceBefore,
            balanceAfter: wallet.balance,
            status: WalletTransactionStatus.COMPLETED,
            coinsConverted: coins,
            description: `Converted ${coins} coins → ₹${amountToCredit}`,
            idempotencyKey,
        });

        // Record coin deduction ledger entry
        await CoinLedger.create({
            wallet: wallet._id,
            userId,
            type: CoinTransactionType.CONVERTED,
            coins,
            balanceBefore: coinsBefore,
            balanceAfter: wallet.coinBalance,
            walletTransactionId: walletTx._id,
            description: `Converted ${coins} coins to ₹${amountToCredit}`,
        });

        EventBridge.publish('payment-events', {
            eventType: 'wallet.coins.converted',
            data: { userId, coins, amountCredited: amountToCredit },
        });

        logger.info('Coins converted to wallet balance', { userId, coins, amountToCredit });

        return {
            coinsConverted: coins,
            amountCredited: amountToCredit,
            newBalance: wallet.balance,
            newCoinBalance: wallet.coinBalance,
        };
    }

    // ── History ─────────────────────────────────────────────────────────────────

    /**
     * Paginated list of INR wallet transactions for a user.
     */
    async getTransactions(userId: string, page: number, limit: number) {
        const [items, total] = await Promise.all([
            WalletTransaction.find({ userId })
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            WalletTransaction.countDocuments({ userId }),
        ]);
        return paginate(items, total, page, limit);
    }

    /**
     * Paginated list of coin ledger entries for a user.
     */
    async getCoinHistory(userId: string, page: number, limit: number) {
        const [items, total] = await Promise.all([
            CoinLedger.find({ userId })
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            CoinLedger.countDocuments({ userId }),
        ]);
        return paginate(items, total, page, limit);
    }
}
