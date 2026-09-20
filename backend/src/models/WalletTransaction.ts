import mongoose, { Schema, Document, Types } from 'mongoose';
import { WalletTransactionType, WalletTransactionStatus } from '../types';

// ─── Interface ───────────────────────────────────────────────────────────────

export interface IWalletTransaction extends Document {
    _id: Types.ObjectId;
    wallet: Types.ObjectId;
    userId: Types.ObjectId;
    type: WalletTransactionType;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    status: WalletTransactionStatus;
    /** Set for TOPUP transactions */
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    /** Set for DEBIT / REFUND transactions */
    bookingId?: Types.ObjectId;
    /** Set for COIN_CONVERSION transactions */
    coinsConverted?: number;
    description: string;
    /** Prevents double-processing of Razorpay webhooks / retries */
    idempotencyKey: string;
    failureReason?: string;
    createdAt: Date;
    updatedAt: Date;
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const WalletTransactionSchema = new Schema<IWalletTransaction>(
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
            enum: Object.values(WalletTransactionType),
            required: true,
            index: true,
        },
        amount: { type: Number, required: true, min: 0 },
        balanceBefore: { type: Number, required: true, min: 0 },
        balanceAfter: { type: Number, required: true, min: 0 },
        status: {
            type: String,
            enum: Object.values(WalletTransactionStatus),
            default: WalletTransactionStatus.PENDING,
            index: true,
        },
        razorpayOrderId: { type: String },
        razorpayPaymentId: { type: String, sparse: true },
        razorpaySignature: String,
        bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', sparse: true },
        coinsConverted: { type: Number, min: 0 },
        description: { type: String, required: true, maxlength: 255 },
        idempotencyKey: { type: String, required: true, unique: true },
        failureReason: String,
    },
    {
        timestamps: true,
        toJSON: {
            transform(_doc, ret) {
                delete (ret as Record<string, unknown>).__v;
                ret.amount = Math.round(ret.amount * 100) / 100;
                ret.balanceBefore = Math.round(ret.balanceBefore * 100) / 100;
                ret.balanceAfter = Math.round(ret.balanceAfter * 100) / 100;
                return ret;
            },
        },
    },
);

WalletTransactionSchema.index({ userId: 1, createdAt: -1 });
WalletTransactionSchema.index({ wallet: 1, type: 1, status: 1 });
WalletTransactionSchema.index({ razorpayOrderId: 1 }, { sparse: true });

export const WalletTransaction = mongoose.model<IWalletTransaction>(
    'WalletTransaction',
    WalletTransactionSchema,
);
