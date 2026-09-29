import { Request, Response, NextFunction } from 'express';
import { WalletService } from '../services/WalletService';
import { ChargeService } from '../services/ChargeService';
import { WithdrawalService } from '../services/WithdrawalService';
import { RewardService } from '../services/RewardService';
import { sendSuccess } from '../utils/helpers';
import { RewardTier, AuthenticatedRequest } from '../types';

const walletService = new WalletService();
const charges = new ChargeService();
const withdrawals = new WithdrawalService();
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
     * POST /wallet/topup
     * Starts a Paynow payment that tops up the wallet once it is paid.
     * Body: { amount, channel, phone?, currency? }
     */
    static async createTopUpOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { userId } = (req as AuthenticatedRequest).user;
            const charge = await charges.start(userId, { ...req.body, purpose: 'topup', amount: Number(req.body.amount) });
            sendSuccess(res, { charge }, 201);
        } catch (error) {
            next(error);
        }
    }

    /** GET /wallet/withdrawals: the user's recent withdrawals */
    static async listWithdrawals(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { userId } = (req as AuthenticatedRequest).user;
            sendSuccess(res, { withdrawals: await withdrawals.mine(userId) });
        } catch (error) {
            next(error);
        }
    }

    /** POST /wallet/withdrawals: send wallet money to EcoCash, OneMoney or InnBucks */
    static async requestWithdrawal(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { userId } = (req as AuthenticatedRequest).user;
            sendSuccess(res, { withdrawal: await withdrawals.request(userId, req.body) }, 201);
        } catch (error) {
            next(error);
        }
    }

    /** POST /wallet/withdrawals/:id/cancel */
    static async cancelWithdrawal(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { userId } = (req as AuthenticatedRequest).user;
            sendSuccess(res, { withdrawal: await withdrawals.cancel(userId, String(req.params.id)) });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/v1/wallet/transactions
     * Paginated list of wallet movements.
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
     * Converts coins into wallet balance.
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
