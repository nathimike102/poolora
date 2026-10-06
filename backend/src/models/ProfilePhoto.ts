import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * The picture a person chose for their profile. Riders and drivers see each
 * other's, so it is served at a public link; the random key in that link is
 * what keeps it from being found by user id. A new picture replaces the old.
 */
export interface IProfilePhoto extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  key: string;
  contentType: 'image/jpeg' | 'image/png';
  bytes: number;
  data: Buffer;
  createdAt: Date;
}

const ProfilePhotoSchema = new Schema<IProfilePhoto>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    key: { type: String, required: true, unique: true },
    contentType: { type: String, enum: ['image/jpeg', 'image/png'], required: true },
    bytes: { type: Number, required: true },
    data: { type: Buffer, required: true, select: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const ProfilePhoto = mongoose.model<IProfilePhoto>('ProfilePhoto', ProfilePhotoSchema);
