import { Request, Response, NextFunction } from 'express';
import { WalletService } from '../services/WalletService';
import { RewardService } from '../services/RewardService';
import { sendSuccess } from '../utils/helpers';
import { RewardTier, AuthenticatedRequest } from '../types';

const walletService = new WalletService();
const rewardService = new RewardService();

export class WalletController {
    /**
     * GET /api/v1/wallet
     * Returns wallet balance, coin balance, tier, and tier benefits.
     */
    static async getWallet(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { userId } = (req as AuthenticatedRequest).user;
            const { wallet, benefits } = await walletService.getBalance(userId);
            sendSuccess(res, {
                balance: wallet.balance,
                coinBalance: wallet.coinBalance,
                tier: wallet.tier,
                totalRidesCompleted: wallet.totalRidesCompleted,
                lifetimeTopUp: wallet.lifetimeTopUp,
                lifetimeSpent: wallet.lifetimeSpent,
                lifetimeCoinsEarned: wallet.lifetimeCoinsEarned,
                lifetimeCoinsConverted: wallet.lifetimeCoinsConverted,
                isLocked: wallet.isLocked,
                lockReason: wallet.lockReason,
                tierBenefits: benefits,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/v1/wallet/topup
     * Creates a Razorpay order to add money to the wallet.
     * Body: { amount: number }
     */
    static async createTopUpOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { userId } = (req as AuthenticatedRequest).user;
            const amount = Number(req.body.amount);
            const order = await walletService.createTopUpOrder(userId, amount);
            sendSuccess(res, order, 201);
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/v1/wallet/topup/confirm
     * Verifies Razorpay payment and credits the wallet.
     * Body: { razorpayOrderId, razorpayPaymentId, razorpaySignature }
     */
    static async confirmTopUp(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { userId } = (req as AuthenticatedRequest).user;
            const {
                razorpayOrderId,
                razorpayPaymentId,
                razorpaySignature,
            } = req.body as {
                razorpayOrderId: string;
                razorpayPaymentId: string;
                razorpaySignature: string;
            };
            const result = await walletService.confirmTopUp(
                userId,
                razorpayOrderId,
                razorpayPaymentId,
                razorpaySignature,
            );
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/v1/wallet/transactions
     * Paginated list of INR wallet movements.
     */
    static async getTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { userId } = (req as AuthenticatedRequest).user;
            const page = parseInt(String(req.query.page ?? '1'), 10);
            const limit = parseInt(String(req.query.limit ?? '20'), 10);
            const result = await walletService.getTransactions(userId, page, limit);
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/v1/wallet/coins/history
     * Paginated list of coin ledger entries.
     */
    static async getCoinHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { userId } = (req as AuthenticatedRequest).user;
            const page = parseInt(String(req.query.page ?? '1'), 10);
            const limit = parseInt(String(req.query.limit ?? '20'), 10);
            const result = await walletService.getCoinHistory(userId, page, limit);
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/v1/wallet/coins/convert
     * Converts coins into INR wallet balance.
     * Body: { coins: number }
     */
    static async convertCoins(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { userId } = (req as AuthenticatedRequest).user;
            const coins = parseInt(String(req.body.coins), 10);
            const result = await walletService.convertCoinsToBalance(userId, coins);
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/v1/wallet/tiers
     * Returns all reward tier information (no auth required).
     */
    static async getTierInfo(_req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const tiers = Object.values(RewardTier).map((tier) =>
                rewardService.getTierBenefits(tier),
            );
            sendSuccess(res, { tiers });
        } catch (error) {
            next(error);
        }
    }
}
