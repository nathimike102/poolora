import mongoose, { Schema, Document, Types } from 'mongoose';
import { CoinTransactionType } from '../types';

// ─── Interface ───────────────────────────────────────────────────────────────

export interface ICoinLedger extends Document {
    _id: Types.ObjectId;
    wallet: Types.ObjectId;
    userId: Types.ObjectId;
    type: CoinTransactionType;
    /** Coins involved in this transaction (always positive) */
    coins: number;
    balanceBefore: number;
    balanceAfter: number;
    /** Source booking for EARNED transactions */
    bookingId?: Types.ObjectId;
    /** Linked WalletTransaction for CONVERTED transactions */
    walletTransactionId?: Types.ObjectId;
    description: string;
    /** Coins expire 12 months after being earned (EARNS only) */
    expiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const CoinLedgerSchema = new Schema<ICoinLedger>(
    {
        wallet: {
            type: Schema.Types.ObjectId,
            ref: 'Wallet',
            required: true,
            index: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: Object.values(CoinTransactionType),
            required: true,
            index: true,
        },
        coins: { type: Number, required: true, min: 0 },
        balanceBefore: { type: Number, required: true, min: 0 },
        balanceAfter: { type: Number, required: true, min: 0 },
        bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', sparse: true },
        walletTransactionId: { type: Schema.Types.ObjectId, ref: 'WalletTransaction', sparse: true },
        description: { type: String, required: true, maxlength: 255 },
        expiresAt: { type: Date },
    },
    {
        timestamps: true,
        toJSON: {
            transform(_doc, ret) {
                delete (ret as any).__v;
                return ret;
            },
        },
    },
);

CoinLedgerSchema.index({ userId: 1, createdAt: -1 });
CoinLedgerSchema.index({ wallet: 1, type: 1 });
// TTL: auto-expire coin entries 12 months after expiresAt
CoinLedgerSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, sparse: true },
);

export const CoinLedger = mongoose.model<ICoinLedger>('CoinLedger', CoinLedgerSchema);
