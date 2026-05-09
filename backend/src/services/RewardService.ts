import { IWallet, Wallet } from '../models/Wallet';
import { RewardTier } from '../types';
import { config } from '../config';
import { logger } from '../utils/logger';
import { CoinLedger } from '../models/CoinLedger';
import { CoinTransactionType } from '../types';

// ─── Tier benefit info ────────────────────────────────────────────────────────

export interface TierBenefits {
    tier: RewardTier;
    label: string;
    coinEarnRate: number;      // coins per ₹ spent in a ride
    minRidesRequired: number;
    nextTier: RewardTier | null;
    nextTierRidesRequired: number | null;
    bonusCoinsOnUpgrade: number;
}

const TIER_ORDER: RewardTier[] = [
    RewardTier.BRONZE,
    RewardTier.SILVER,
    RewardTier.GOLD,
    RewardTier.PLATINUM,
    RewardTier.DIAMOND,
];

export class RewardService {
    /**
     * Compute the correct tier for a given number of completed rides.
     */
    computeTier(totalRidesCompleted: number): RewardTier {
        const thresholds = config.wallet.tierThresholds;
        let tier = RewardTier.BRONZE;
        if (totalRidesCompleted >= thresholds.diamond) tier = RewardTier.DIAMOND;
        else if (totalRidesCompleted >= thresholds.platinum) tier = RewardTier.PLATINUM;
        else if (totalRidesCompleted >= thresholds.gold) tier = RewardTier.GOLD;
        else if (totalRidesCompleted >= thresholds.silver) tier = RewardTier.SILVER;
        return tier;
    }

    /**
     * Gets coin earn rate for a given tier.
     */
    getCoinEarnRate(tier: RewardTier): number {
        return config.wallet.coinEarnRates[tier] ?? 1;
    }

    /**
     * Returns human-readable tier benefits.
     */
    getTierBenefits(tier: RewardTier): TierBenefits {
        const idx = TIER_ORDER.indexOf(tier);
        const nextTier = idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : null;
        const thresholds = config.wallet.tierThresholds;
        const bonusMap = config.wallet.bonusCoinsOnTierUpgrade;

        return {
            tier,
            label: tier.charAt(0).toUpperCase() + tier.slice(1),
            coinEarnRate: this.getCoinEarnRate(tier),
            minRidesRequired: thresholds[tier],
            nextTier,
            nextTierRidesRequired: nextTier ? thresholds[nextTier] : null,
            bonusCoinsOnUpgrade: bonusMap[tier] ?? 0,
        };
    }

    /**
     * Re-evaluates the wallet's tier after a ride completion.
     * Awards bonus coins if the tier changed upward.
     * Returns the new tier (or the same if unchanged).
     */
    async checkAndUpgradeTier(wallet: IWallet): Promise<RewardTier> {
        const newTier = this.computeTier(wallet.totalRidesCompleted);

        if (newTier === wallet.tier) return newTier;

        const oldTier = wallet.tier;
        const bonusCoins = config.wallet.bonusCoinsOnTierUpgrade[newTier] ?? 0;

        wallet.tier = newTier;
        if (bonusCoins > 0) {
            const before = wallet.coinBalance;
            wallet.coinBalance += bonusCoins;
            wallet.lifetimeCoinsEarned += bonusCoins;
            await wallet.save();

            // Record in coin ledger
            await CoinLedger.create({
                wallet: wallet._id,
                userId: wallet.userId,
                type: CoinTransactionType.BONUS,
                coins: bonusCoins,
                balanceBefore: before,
                balanceAfter: wallet.coinBalance,
                description: `Tier upgrade bonus: ${oldTier} → ${newTier} (+${bonusCoins} coins)`,
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            });
        } else {
            await wallet.save();
        }

        logger.info('Wallet tier upgraded', {
            userId: wallet.userId,
            oldTier,
            newTier,
            bonusCoins,
        });

        return newTier;
    }

    /**
     * Compute how many coins should be earned for a given fare and tier.
     */
    computeCoinsForFare(fareAmount: number, tier: RewardTier): number {
        const rate = this.getCoinEarnRate(tier);
        return Math.floor(fareAmount * rate);
    }
}
