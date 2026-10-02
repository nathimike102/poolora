import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * A kombi rank or bus terminus (UC-R12). Riders see it in place search, and
 * a booking dropping them at one can say when their bus leaves. Only shown
 * once an admin has placed it on the map and switched it on.
 */
export interface ITransitHub extends Document {
  _id: Types.ObjectId;
  market: string;
  name: string;
  kind: 'kombi_rank' | 'bus_terminus';
  city: string;
  address?: string;
  /** Other names people search for, e.g. "Musika" */
  aliases: string[];
  location: { type: 'Point'; coordinates: [number, number] };
  active: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TransitHubSchema = new Schema<ITransitHub>(
  {
    market: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    kind: { type: String, enum: ['kombi_rank', 'bus_terminus'], required: true },
    city: { type: String, required: true, trim: true, maxlength: 60 },
    address: { type: String, trim: true, maxlength: 200 },
    aliases: { type: [{ type: String, trim: true, maxlength: 60 }], default: [] },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    active: { type: Boolean, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, toJSON: { transform(_doc, ret) { delete (ret as Record<string, unknown>).__v; return ret; } } },
);

TransitHubSchema.index({ location: '2dsphere' });
TransitHubSchema.index({ market: 1, name: 1, city: 1 }, { unique: true });

export const TransitHub = mongoose.model<ITransitHub>('TransitHub', TransitHubSchema);
