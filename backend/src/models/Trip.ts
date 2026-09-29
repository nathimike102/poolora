import mongoose, { Schema, Document, Types } from 'mongoose';

export const TRIP_TYPES = ['vacation', 'weekend', 'business'] as const;
export const TRIP_INTERESTS = ['hiking', 'culture', 'food', 'beach', 'adventure', 'nightlife', 'shopping', 'photography', 'wildlife', 'spiritual', 'relaxation'] as const;
/** UC-T01 business rules */
export const TRIP_LIMITS = { minGroup: 2, maxGroup: 8, minDays: 1, maxDays: 90 } as const;

export type TripVote = 'yes' | 'no' | 'maybe';

/**
 * A group trip (Phase 4, UC-T01 to UC-T05): the plan, who is going, the
 * activities the group votes on, and payments members have settled
 * between themselves. Expenses are in TripExpense.
 */
export interface ITrip extends Document {
  _id: Types.ObjectId;
  organizer: Types.ObjectId;
  title: string;
  description?: string;
  tripType: (typeof TRIP_TYPES)[number];
  startDate: Date;
  endDate: Date;
  destinations: Array<{ name: string; lat?: number; lng?: number }>;
  /** Estimated cost per person, in rupees */
  budgetPerPerson?: number;
  interests: string[];
  itinerary: Array<{ day: number; title: string; notes?: string }>;
  maxGroupSize: number;
  visibility: 'public' | 'private';
  /** Private trips are joined with this code */
  inviteCode: string;
  status: 'planning' | 'ongoing' | 'completed' | 'cancelled';
  members: Array<{ user: Types.ObjectId; role: 'organizer' | 'member'; joinedAt: Date; upiId?: string }>;
  joinRequests: Array<{ _id: Types.ObjectId; user: Types.ObjectId; message?: string; status: 'pending' | 'accepted' | 'declined'; at: Date }>;
  activities: Array<{
    _id: Types.ObjectId;
    title: string;
    date?: Date;
    cost?: number;
    durationMins?: number;
    notes?: string;
    proposedBy: Types.ObjectId;
    votes: Array<{ user: Types.ObjectId; vote: TripVote }>;
    status: 'proposed' | 'confirmed' | 'rejected';
    expense?: Types.ObjectId;
  }>;
  /** Payments members say they made to each other (UC-T05 step 5) */
  settlements: Array<{ _id: Types.ObjectId; from: Types.ObjectId; to: Types.ObjectId; amount: number; markedBy: Types.ObjectId; at: Date }>;
  /** Members' ratings of the organizer after the trip (UC-T02); comments are private */
  organizerRatings: Array<{ user: Types.ObjectId; score: number; comment?: string; at: Date }>;
  createdAt: Date;
  updatedAt: Date;
}

const TripSchema = new Schema<ITrip>(
  {
    organizer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 2000 },
    tripType: { type: String, enum: TRIP_TYPES, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    destinations: [{ _id: false, name: { type: String, required: true, trim: true, maxlength: 120 }, lat: Number, lng: Number }],
    budgetPerPerson: { type: Number, min: 0 },
    interests: [{ type: String, enum: TRIP_INTERESTS }],
    itinerary: [{ _id: false, day: { type: Number, min: 1 }, title: { type: String, maxlength: 120 }, notes: { type: String, maxlength: 1000 } }],
    maxGroupSize: { type: Number, min: 2, max: 8, required: true },
    visibility: { type: String, enum: ['public', 'private'], default: 'public' },
    inviteCode: { type: String, required: true, unique: true },
    status: { type: String, enum: ['planning', 'ongoing', 'completed', 'cancelled'], default: 'planning' },
    members: [
      {
        _id: false,
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        role: { type: String, enum: ['organizer', 'member'], default: 'member' },
        joinedAt: { type: Date, default: Date.now },
        upiId: { type: String, trim: true, maxlength: 100 },
      },
    ],
    joinRequests: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        message: { type: String, maxlength: 500 },
        status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
        at: { type: Date, default: Date.now },
      },
    ],
    activities: [
      {
        title: { type: String, required: true, maxlength: 120 },
        date: Date,
        cost: { type: Number, min: 0 },
        durationMins: { type: Number, min: 0 },
        notes: { type: String, maxlength: 1000 },
        proposedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        votes: [{ _id: false, user: { type: Schema.Types.ObjectId, ref: 'User' }, vote: { type: String, enum: ['yes', 'no', 'maybe'] } }],
        status: { type: String, enum: ['proposed', 'confirmed', 'rejected'], default: 'proposed' },
        expense: { type: Schema.Types.ObjectId, ref: 'TripExpense' },
      },
    ],
    settlements: [
      {
        from: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        to: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        amount: { type: Number, required: true, min: 0.01 },
        markedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        at: { type: Date, default: Date.now },
      },
    ],
    organizerRatings: [
      {
        _id: false,
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        score: { type: Number, min: 1, max: 5, required: true },
        comment: { type: String, trim: true, maxlength: 500 },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

TripSchema.index({ visibility: 1, status: 1, startDate: 1 });
TripSchema.index({ 'members.user': 1 });

export const Trip = mongoose.model<ITrip>('Trip', TripSchema);
