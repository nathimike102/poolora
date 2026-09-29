import mongoose, { Schema, Document, Types } from 'mongoose';
import { PaymentStatus, PaymentMethod } from '../types';

export interface IPayment extends Document {
  _id: Types.ObjectId;
  booking: Types.ObjectId;
  rider: Types.ObjectId;
  driver: Types.ObjectId;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method?: PaymentMethod;
  /** The Paynow charge's reference */
  reference: string;
  paynowReference?: string;
  /** What Paynow charged, when it was in ZiG; `amount` is always US dollars */
  chargedCurrency?: 'USD' | 'ZWG';
  chargedAmount?: number;
  exchangeRate?: number;
  refundId?: string;
  refundAmount?: number;
  refundReason?: string;
  driverPayout: number;
  platformCommission: number;
  platformCommissionRate: number;
  settlementStatus: 'pending' | 'processing' | 'settled';
  settlementDate?: Date;
  failureReason?: string;
  metadata: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    rider: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    driver: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD', uppercase: true },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.CREATED,
      index: true,
    },
    method: { type: String, enum: Object.values(PaymentMethod) },
    reference: { type: String, required: true, unique: true },
    paynowReference: String,
    chargedCurrency: { type: String, enum: ['USD', 'ZWG'] },
    chargedAmount: Number,
    exchangeRate: Number,
    refundId: String,
    refundAmount: { type: Number, min: 0 },
    refundReason: String,
    driverPayout: { type: Number, required: true, min: 0 },
    platformCommission: { type: Number, required: true, min: 0 },
    platformCommissionRate: { type: Number, required: true, default: 0.15, min: 0, max: 1 },
    settlementStatus: {
      type: String,
      enum: ['pending', 'processing', 'settled'],
      default: 'pending',
    },
    settlementDate: Date,
    failureReason: String,
    metadata: { type: Schema.Types.Mixed, default: {} },
    idempotencyKey: { type: String, required: true, unique: true },
  },
  {
    timestamps: true,
    toJSON: { transform(_doc, ret) { delete (ret as Record<string, unknown>).__v; return ret; } },
  },
);

PaymentSchema.index({ rider: 1, createdAt: -1 });
PaymentSchema.index({ driver: 1, settlementStatus: 1 });

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);
