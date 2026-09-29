/**
 * WithdrawalRequest.ts
 *
 * A user asking for wallet money to be sent to their mobile money account
 * (drivers' earnings, refunds). The amount leaves the wallet when the
 * request is made; an admin sends it and marks it paid, or rejects it and
 * the amount goes back. See services/WithdrawalService.ts.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type WithdrawalStatus = 'pending' | 'paid' | 'rejected' | 'cancelled';

export interface IWithdrawalRequest extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  /** US dollars */
  amount: number;
  channel: 'ecocash' | 'onemoney' | 'innbucks';
  /** E.164 */
  payNumber: string;
  status: WithdrawalStatus;
  /** The mobile money transaction id the admin sent it with */
  payoutReference?: string;
  note?: string;
  processedBy?: Types.ObjectId;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WithdrawalRequestSchema = new Schema<IWithdrawalRequest>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    channel: { type: String, enum: ['ecocash', 'onemoney', 'innbucks'], required: true },
    payNumber: { type: String, required: true },
    status: { type: String, enum: ['pending', 'paid', 'rejected', 'cancelled'], default: 'pending', index: true },
    payoutReference: { type: String, maxlength: 100 },
    note: { type: String, maxlength: 500 },
    processedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    processedAt: Date,
  },
  { timestamps: true },
);

WithdrawalRequestSchema.index({ status: 1, createdAt: 1 });

export const WithdrawalRequest = mongoose.model<IWithdrawalRequest>('WithdrawalRequest', WithdrawalRequestSchema);
