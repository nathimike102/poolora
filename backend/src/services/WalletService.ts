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
} from '../utils/AppError';
import { paginate } from '../utils/helpers';
import { EventBridge } from '../events';
import { logger } from '../utils/logger';
import { RewardService } from './RewardService';
import { money } from '../config/region';

const rewardService = new RewardService();

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
     * Checks a top-up can go ahead, before the user is asked to pay. The
     * payment itself goes through Paynow (ChargeService), which calls
     * completeTopUp once it is paid.
     */
    async checkTopUp(userId: string, amount: number): Promise<void> {
        const { minTopUpAmount, maxTopUpAmount } = config.wallet;
        if (amount < minTopUpAmount || amount > maxTopUpAmount) {
            throw new AppError(
                `Top-up amount must be between ${money(minTopUpAmount)} and ${money(maxTopUpAmount)}`,
                400,
                'INVALID_AMOUNT',
            );
        }
        const wallet = await this.getOrCreateWallet(userId);
        if (wallet.isLocked) {
            throw new AppError('Wallet is locked. Please contact support.', 403, 'WALLET_LOCKED');
        }
        // Reject before the user pays, rather than holding money we cannot take
        if (wallet.balance + amount > config.wallet.maxWalletBalance) {
            throw new AppError(
                `Top-up would exceed the maximum wallet balance of ${money(config.wallet.maxWalletBalance)}`,
                400,
                'BALANCE_LIMIT_EXCEEDED',
            );
        }
    }

    /**
     * Credits a paid top-up. Idempotent by the Paynow reference. The money
     * has already left the payer, so it is credited even if the wallet has
     * since been locked or passed its limit; that is logged for a look.
     */
    async completeTopUp(userId: string, amount: number, reference: string): Promise<boolean> {
        const wallet = await this.getOrCreateWallet(userId);
        if (wallet.isLocked || wallet.balance + amount > config.wallet.maxWalletBalance) {
            logger.warn('Paid top-up credited to a locked or full wallet', { userId, amount, reference });
        }
        const credited = await this.claimAndCredit(userId, amount, {
            type: WalletTransactionType.TOPUP,
            description: `Wallet top-up of ${money(amount)}`,
            idempotencyKey: `topup_${reference}`,
            gatewayReference: reference,
            lifetimeTopUp: true,
        });
        if (credited) {
            EventBridge.publish('payment-events', {
                eventType: 'wallet.topup.completed',
                data: { userId, amount, walletBalance: credited.balanceAfter },
            });
            logger.info('Wallet top-up completed', { userId, amount, reference });
        }
        return Boolean(credited);
    }

    /**
     * Adds money to a wallet at most once per idempotency key. The ledger
     * entry is claimed first (the key is unique), then the balance moves with
     * an atomic $inc, so neither retries nor concurrent calls can credit twice
     * or lose an update. Returns null when the key was already used.
     */
    private async claimAndCredit(
        userId: string,
        amount: number,
        entry: {
            type: WalletTransactionType;
            description: string;
            idempotencyKey: string;
            bookingId?: string;
            gatewayReference?: string;
            lifetimeTopUp?: boolean;
        },
    ): Promise<{ balanceAfter: number } | null> {
        const wallet = await this.getOrCreateWallet(userId);
        let transaction;
        try {
            transaction = await WalletTransaction.create({
                wallet: wallet._id,
                userId,
                type: entry.type,
                amount,
                balanceBefore: wallet.balance,
                balanceAfter: wallet.balance + amount,
                status: WalletTransactionStatus.PENDING,
                bookingId: entry.bookingId,
                gatewayReference: entry.gatewayReference,
                description: entry.description.slice(0, 255),
                idempotencyKey: entry.idempotencyKey,
            });
        } catch (error) {
            if ((error as { code?: number }).code === 11000) {
                logger.info('Duplicate wallet credit ignored', { userId, idempotencyKey: entry.idempotencyKey });
                return null;
            }
            throw error;
        }
        const after = await Wallet.findOneAndUpdate(
            { _id: wallet._id },
            { $inc: { balance: amount, ...(entry.lifetimeTopUp ? { lifetimeTopUp: amount } : {}) } },
            { new: true },
        );
        const balanceAfter = Math.round(after!.balance * 100) / 100;
        transaction.balanceBefore = Math.round((balanceAfter - amount) * 100) / 100;
        transaction.balanceAfter = balanceAfter;
        transaction.status = WalletTransactionStatus.COMPLETED;
        await transaction.save();
        return { balanceAfter };
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
                `Insufficient wallet balance. Have ${money(current.balance)}, need ${money(amount)}`,
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
     * Credits money back to a wallet (a cancelled booking, a dispute decision).
     * Idempotent by idempotencyKey, which defaults to one refund per booking
     * and user; a dispute passes its own key so it is not mistaken for the
     * cancellation refund. Creates the wallet if the user has none yet.
     */
    async refundToWallet(
        userId: string,
        bookingId: string,
        amount: number,
        reason: string,
        idempotencyKey = `refund_${bookingId}_${userId}`,
    ): Promise<void> {
        const credited = await this.claimAndCredit(userId, amount, {
            type: WalletTransactionType.REFUND,
            bookingId,
            description: `Refund for booking ${bookingId}: ${reason}`,
            idempotencyKey,
        });
        if (!credited) return;
        EventBridge.publish('payment-events', {
            eventType: 'wallet.refund.completed',
            data: { userId, bookingId, amount },
        });
    }

    /**
     * Credits the wallet for something other than a booking refund: a parcel
     * claim payout, or a Paynow payment that was not needed. Idempotent by key.
     */
    async credit(userId: string, amount: number, description: string, idempotencyKey: string, gatewayReference?: string): Promise<boolean> {
        const credited = await this.claimAndCredit(userId, amount, {
            type: WalletTransactionType.REFUND,
            description,
            idempotencyKey,
            gatewayReference,
        });
        return Boolean(credited);
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
                description: `Earned ${coinsEarned} coins from ride (${wallet.tier} tier, ${money(fareAmount)})`,
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
     * Converts coins to wallet balance.
     * Rate: config.wallet.coinToUsdRate (default US$0.01 per coin).
     * Minimum: config.wallet.minCoinConversion coins.
     */
    async convertCoinsToBalance(userId: string, coins: number) {
        const { coinToUsdRate, minCoinConversion, maxWalletBalance } = config.wallet;

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

        const amountToCredit = Math.round(coins * coinToUsdRate * 100) / 100;

        if (wallet.balance + amountToCredit > maxWalletBalance) {
            throw new AppError(
                `Conversion would exceed maximum wallet balance of ${money(maxWalletBalance)}`,
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

        // Credit the dollar balance
        const balanceBefore = wallet.balance;
        wallet.balance += amountToCredit;
        await wallet.save();

        // Create the wallet transaction
        const walletTx = await WalletTransaction.create({
            wallet: wallet._id,
            userId,
            type: WalletTransactionType.COIN_CONVERSION,
            amount: amountToCredit,
            balanceBefore,
            balanceAfter: wallet.balance,
            status: WalletTransactionStatus.COMPLETED,
            coinsConverted: coins,
            description: `Converted ${coins} coins → ${money(amountToCredit)}`,
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
            description: `Converted ${coins} coins to ${money(amountToCredit)}`,
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
     * Paginated list of wallet transactions for a user.
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
