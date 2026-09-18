import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEmergencyToken extends Document {
  _id: Types.ObjectId;
  token: string;
  emergencyId: Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
}

const EmergencyTokenSchema = new Schema<IEmergencyToken>(
  {
    token: { type: String, required: true, unique: true, index: true },
    emergencyId: { type: Schema.Types.ObjectId, ref: 'EmergencyRecord', required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

export const EmergencyToken = mongoose.model<IEmergencyToken>('EmergencyToken', EmergencyTokenSchema);
