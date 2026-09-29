import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * A photo taken as parcel evidence: by the driver at pickup and delivery
 * (UC-P03), or by the sender or recipient for a claim (UC-P05). Stored in S3
 * when it is configured, otherwise in this document. Only the people on the
 * parcel and admins can open it.
 */
export interface IParcelPhoto extends Document {
  _id: Types.ObjectId;
  parcel: Types.ObjectId;
  stage: 'pickup' | 'delivery' | 'claim';
  uploadedBy: Types.ObjectId;
  contentType: 'image/jpeg' | 'image/png';
  bytes: number;
  storage: 's3' | 'db';
  s3Key?: string;
  data?: Buffer;
  /** Where the phone was when the photo was sent, when it shared its location */
  location?: { type: 'Point'; coordinates: [number, number] };
  createdAt: Date;
}

const ParcelPhotoSchema = new Schema<IParcelPhoto>(
  {
    parcel: { type: Schema.Types.ObjectId, ref: 'ParcelPooling', required: true, index: true },
    stage: { type: String, enum: ['pickup', 'delivery', 'claim'], required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    contentType: { type: String, enum: ['image/jpeg', 'image/png'], required: true },
    bytes: { type: Number, required: true },
    storage: { type: String, enum: ['s3', 'db'], required: true },
    s3Key: String,
    data: { type: Buffer, select: false },
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number], default: undefined },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const ParcelPhoto = mongoose.model<IParcelPhoto>('ParcelPhoto', ParcelPhotoSchema);
