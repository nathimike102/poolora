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

export const Rating = mongoose.model<IRating>('Rating', RatingSchema);
