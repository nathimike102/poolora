import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * Money spent for a group trip (UC-T03): who paid, and whom it is split
 * between, equally.
 */
export interface ITripExpense extends Document {
  _id: Types.ObjectId;
  trip: Types.ObjectId;
  description: string;
  /** US dollars */
  amount: number;
  paidBy: Types.ObjectId;
  splitAmong: Types.ObjectId[];
  createdBy: Types.ObjectId;
  /** Set when a confirmed activity added it (UC-T04 step 7) */
  activity?: Types.ObjectId;
  spentAt: Date;
  createdAt: Date;
}

const TripExpenseSchema = new Schema<ITripExpense>(
  {
    trip: { type: Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
    description: { type: String, required: true, trim: true, maxlength: 200 },
    amount: { type: Number, required: true, min: 0.01 },
    paidBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    splitAmong: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], validate: (v: unknown[]) => v.length > 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    activity: { type: Schema.Types.ObjectId },
    spentAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const TripExpense = mongoose.model<ITripExpense>('TripExpense', TripExpenseSchema);
