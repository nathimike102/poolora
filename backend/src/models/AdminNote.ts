import mongoose, { Schema, Document, Types } from 'mongoose';

/** Internal note on a user account, seen only by admins (UC-A05 step 4). */
export interface IAdminNote extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  author: Types.ObjectId;
  text: string;
  createdAt: Date;
}

const AdminNoteSchema = new Schema<IAdminNote>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const AdminNote = mongoose.model<IAdminNote>('AdminNote', AdminNoteSchema);
