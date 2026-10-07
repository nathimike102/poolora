import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * A company's monthly bill for its share of its staff's completed trips
 * (UC-C03). The lines are a snapshot taken when it is issued: who rode,
 * when and what it cost the company, never where they went.
 */
export interface ICompanyInvoice extends Document {
  _id: Types.ObjectId;
  organisation: Types.ObjectId;
  /** The month billed, YYYY-MM in market time */
  month: string;
  number: string;
  lines: Array<{ booking: Types.ObjectId; date: Date; member: string; fare: number; companyShare: number; co2SavedKg: number }>;
  trips: number;
  members: number;
  /** Sum of the lines' company shares, in US$ */
  amount: number;
  /** Credits (negative) or charges an admin added before payment, e.g. after a dispute */
  adjustments: Array<{ amount: number; reason: string; by: Types.ObjectId; at: Date }>;
  /** What the company owes: the amount plus adjustments */
  total: number;
  co2SavedKg: number;
  status: 'issued' | 'paid';
  issuedAt: Date;
  /** Bank transfer within 30 days (decided 2 October 2026) */
  dueAt: Date;
  emailedAt?: Date;
  emailError?: string;
  paidAt?: Date;
  paidReference?: string;
  recordedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CompanyInvoiceSchema = new Schema<ICompanyInvoice>(
  {
    organisation: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    number: { type: String, required: true, unique: true },
    lines: {
      type: [{
        _id: false,
        booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
        date: { type: Date, required: true },
        member: { type: String, required: true },
        fare: { type: Number, required: true },
        companyShare: { type: Number, required: true },
        co2SavedKg: { type: Number, default: 0 },
      }],
      default: [],
    },
    trips: { type: Number, required: true },
    members: { type: Number, required: true },
    amount: { type: Number, required: true },
    adjustments: {
      type: [{ _id: false, amount: { type: Number, required: true }, reason: { type: String, required: true, maxlength: 300 }, by: { type: Schema.Types.ObjectId, ref: 'User', required: true }, at: { type: Date, required: true } }],
      default: [],
    },
    total: { type: Number, required: true },
    co2SavedKg: { type: Number, default: 0 },
    status: { type: String, enum: ['issued', 'paid'], default: 'issued', index: true },
    issuedAt: { type: Date, required: true },
    dueAt: { type: Date, required: true, index: true },
    emailedAt: Date,
    emailError: String,
    paidAt: Date,
    paidReference: { type: String, maxlength: 100 },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: { transform(_doc, ret) { delete (ret as Record<string, unknown>).__v; return ret; } },
  },
);

// One bill per company per month, however many backend instances run the job
CompanyInvoiceSchema.index({ organisation: 1, month: 1 }, { unique: true });

export const CompanyInvoice = mongoose.model<ICompanyInvoice>('CompanyInvoice', CompanyInvoiceSchema);
