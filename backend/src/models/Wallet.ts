import mongoose, { Schema, Document, Types } from 'mongoose';
import { RewardTier } from '../types';

// ─── Interface ───────────────────────────────────────────────────────────────

export interface IWallet extends Document {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    /** INR balance in the wallet (2 decimal precision) */
    balance: number;
    /** Accumulated reward coins (integer) */
    coinBalance: number;
    /** Current reward tier — computed from totalRidesCompleted */
    tier: RewardTier;
    /** Total rides completed as rider or driver — drives tier calculation */
    totalRidesCompleted: number;
    /** Lifetime stat counters */
    lifetimeTopUp: number;
    lifetimeSpent: number;
    lifetimeCoinsEarned: number;
    lifetimeCoinsConverted: number;
    /** Admin-level freeze */
    isLocked: boolean;
    lockReason?: string;
    createdAt: Date;
    updatedAt: Date;
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const WalletSchema = new Schema<IWallet>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
            index: true,
        },
        balance: {
            type: Number,
            default: 0,
            min: 0,
            max: 100000,
            // Store as cents internally, return as rupees externally via toJSON
        },
        coinBalance: {
            type: Number,
            default: 0,
            min: 0,
        },
        tier: {
            type: String,
            enum: Object.values(RewardTier),
            default: RewardTier.BRONZE,
            index: true,
        },
        totalRidesCompleted: {
            type: Number,
            default: 0,
            min: 0,
        },
        lifetimeTopUp: { type: Number, default: 0, min: 0 },
        lifetimeSpent: { type: Number, default: 0, min: 0 },
        lifetimeCoinsEarned: { type: Number, default: 0, min: 0 },
        lifetimeCoinsConverted: { type: Number, default: 0, min: 0 },
        isLocked: { type: Boolean, default: false },
        lockReason: { type: String },
    },
    {
        timestamps: true,
        toJSON: {
            transform(_doc, ret) {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete (ret as any).__v;
                ret.balance = Math.round(ret.balance * 100) / 100;
                return ret;
            },
        },
    },
);

WalletSchema.index({ userId: 1, tier: 1 });

export const Wallet = mongoose.model<IWallet>('Wallet', WalletSchema);
