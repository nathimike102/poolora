/**
 * GatewayCharge.ts
 *
 * One Paynow transaction: what it pays for (a booking, a parcel or a wallet
 * top-up), how much in US dollars and in the currency charged, the channel,
 * and where it stands. A booking or parcel can have several charges when the
 * payer retries with another method; only one of them is ever applied, and
 * any other that is paid is credited to the payer's wallet.
 * See services/ChargeService.ts.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type ChargePurpose = 'booking' | 'parcel' | 'topup';
export type ChargeStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'disputed';

export interface IGatewayCharge extends Document {
  _id: Types.ObjectId;
  /** Sent to Paynow as the reference, e.g. BK-6512ab…-2 */
  reference: string;
  purpose: ChargePurpose;
  /** The booking or parcel; absent for top-ups */
  target?: Types.ObjectId;
  user: Types.ObjectId;
  /** What is owed, in US dollars */
  amountUsd: number;
  currency: 'USD' | 'ZWG';
  /** What Paynow charges, in `currency` */
  chargedAmount: number;
  /** ZiG per US dollar used, when charged in ZiG */
  exchangeRate?: number;
  channel: 'ecocash' | 'onemoney' | 'innbucks' | 'card';
  /** Mobile money number charged, E.164 */
  phone?: string;
  status: ChargeStatus;
  paynowStatus?: string;
  paynowReference?: string;
  pollUrl: string;
  redirectUrl?: string;
  authorizationCode?: string;
  authorizationExpires?: string;
  paidAt?: Date;
  /** Set once the payment has been applied to its booking, parcel or wallet */
  appliedAt?: Date;
  /** Paid, but not needed (already paid another way, or cancelled): credited to the wallet */
  creditedToWalletAt?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GatewayChargeSchema = new Schema<IGatewayCharge>(
  {
    reference: { type: String, required: true, unique: true },
    purpose: { type: String, enum: ['booking', 'parcel', 'topup'], required: true },
    target: { type: Schema.Types.ObjectId, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amountUsd: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['USD', 'ZWG'], required: true },
    chargedAmount: { type: Number, required: true, min: 0 },
    exchangeRate: Number,
    channel: { type: String, enum: ['ecocash', 'onemoney', 'innbucks', 'card'], required: true },
    phone: String,
    status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded', 'disputed'], default: 'pending', index: true },
    paynowStatus: String,
    paynowReference: String,
    pollUrl: { type: String, required: true },
    redirectUrl: String,
    authorizationCode: String,
    authorizationExpires: String,
    paidAt: Date,
    appliedAt: Date,
    creditedToWalletAt: Date,
    failureReason: String,
  },
  { timestamps: true },
);

GatewayChargeSchema.index({ status: 1, createdAt: 1 });

export const GatewayCharge = mongoose.model<IGatewayCharge>('GatewayCharge', GatewayChargeSchema);
