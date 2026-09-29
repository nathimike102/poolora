import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * A user's appeal against a suspension or block (UC-A05 3a), filed within 30
 * days. An admin other than the one who took the action decides it: upheld
 * leaves the action in place; overturned lifts it.
 */
export interface IAppeal extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  kind: 'suspension' | 'block';
  /** The reason the user was given, as it stood when they appealed */
  actionReason?: string;
  /** Who took the action, when known; they cannot decide the appeal */
  actionBy?: Types.ObjectId;
  actionAt?: Date;
  message: string;
  status: 'open' | 'upheld' | 'overturned';
  decidedBy?: Types.ObjectId;
  decidedAt?: Date;
  decisionNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AppealSchema = new Schema<IAppeal>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: ['suspension', 'block'], required: true },
    actionReason: String,
    actionBy: { type: Schema.Types.ObjectId, ref: 'User' },
    actionAt: Date,
    message: { type: String, required: true, maxlength: 2000 },
    status: { type: String, enum: ['open', 'upheld', 'overturned'], default: 'open', index: true },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decidedAt: Date,
    decisionNote: String,
  },
  { timestamps: true },
);

export const Appeal = mongoose.model<IAppeal>('Appeal', AppealSchema);
