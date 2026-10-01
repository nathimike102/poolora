import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IRating extends Document {
  _id: Types.ObjectId;
  booking: Types.ObjectId;
  ride: Types.ObjectId;
  rater: Types.ObjectId;
  ratee: Types.ObjectId;
  raterRole: 'rider' | 'driver';
  score: number;
  tags: string[];
  comment?: string;
  /** Star ratings per category (UC-R06 step 3); `score` is the overall one */
  categories?: { behavior?: number; cleanliness?: number; punctuality?: number };
  /**
   * "Did you feel safe?" 1 (no) to 5 (yes). Confidential: only the safety
   * team sees it, never the person rated (PRD: separate safety ratings).
   */
  safety?: number;
  /** Problems reported with the rating (step 5); private, never shown publicly */
  issues?: Array<'safety' | 'route' | 'payment'>;
  issueDetails?: string;
  /** A written review is public only after an admin approves it */
  commentStatus?: 'pending' | 'approved' | 'rejected';
  moderatedBy?: Types.ObjectId;
  moderatedAt?: Date;
  moderationNote?: string;
  isValidated: boolean;
  isFlagged: boolean;
  flagReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ALLOWED_TAGS = [
  'cleanliness',
  'punctuality',
  'driving',
  'politeness',
  'communication',
  'safety',
  'comfort',
  'navigation',
  'vehicle_condition',
];

const RatingSchema = new Schema<IRating>(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    ride: { type: Schema.Types.ObjectId, ref: 'Ride', required: true },
    rater: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    ratee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    raterRole: { type: String, enum: ['rider', 'driver'], required: true },
    score: { type: Number, required: true, min: 1, max: 5 },
    tags: [{ type: String, enum: ALLOWED_TAGS }],
    comment: { type: String, maxlength: 500 },
    categories: {
      type: new Schema(
        { behavior: { type: Number, min: 1, max: 5 }, cleanliness: { type: Number, min: 1, max: 5 }, punctuality: { type: Number, min: 1, max: 5 } },
        { _id: false },
      ),
      default: undefined,
    },
    safety: { type: Number, min: 1, max: 5 },
    issues: { type: [{ type: String, enum: ['safety', 'route', 'payment'] }], default: undefined },
    issueDetails: { type: String, maxlength: 1000 },
    commentStatus: { type: String, enum: ['pending', 'approved', 'rejected'] },
    moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    moderatedAt: Date,
    moderationNote: String,
    isValidated: { type: Boolean, default: false },
    isFlagged: { type: Boolean, default: false },
    flagReason: String,
  },
  {
    timestamps: true,
    toJSON: { transform(_doc, ret) { delete (ret as Record<string, unknown>).__v; return ret; } },
  },
);

// One rating per rater per booking
RatingSchema.index({ booking: 1, rater: 1 }, { unique: true });
RatingSchema.index({ ratee: 1, isValidated: 1 });
RatingSchema.index({ ride: 1 });
RatingSchema.index({ commentStatus: 1, createdAt: 1 });

export const Rating = mongoose.model<IRating>('Rating', RatingSchema);
