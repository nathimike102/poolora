import mongoose, { Schema, Document, Types } from 'mongoose';

/** Support categories (UC-X02) */
export const SUPPORT_CATEGORIES = ['account', 'payment', 'dispute', 'technical', 'safety', 'feature', 'feedback'] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

/** Safety and payment problems are answered first */
export const URGENT_CATEGORIES: readonly SupportCategory[] = ['safety', 'payment'];

/**
 * A support request from a user (UC-X02), answered by the Poolora team in
 * a thread of messages.
 */
export interface ISupportTicket extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  category: SupportCategory;
  subject: string;
  booking?: Types.ObjectId;
  status: 'open' | 'answered' | 'closed';
  priority: 'urgent' | 'normal';
  messages: Array<{ from: 'user' | 'support'; author: Types.ObjectId; text: string; at: Date }>;
  /** Device and app version, to help with technical problems */
  appInfo?: string;
  assignedTo?: Types.ObjectId;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: String, enum: SUPPORT_CATEGORIES, required: true },
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking' },
    status: { type: String, enum: ['open', 'answered', 'closed'], default: 'open' },
    priority: { type: String, enum: ['urgent', 'normal'], default: 'normal' },
    messages: [
      {
        _id: false,
        from: { type: String, enum: ['user', 'support'], required: true },
        author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        text: { type: String, required: true, maxlength: 4000 },
        at: { type: Date, default: Date.now },
      },
    ],
    appInfo: { type: String, maxlength: 200 },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    closedAt: Date,
  },
  { timestamps: true },
);

SupportTicketSchema.index({ status: 1, priority: 1, createdAt: 1 });

export const SupportTicket = mongoose.model<ISupportTicket>('SupportTicket', SupportTicketSchema);
