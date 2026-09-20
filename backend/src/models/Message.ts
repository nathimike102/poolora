import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IMessage extends Document {
  _id: Types.ObjectId;
  booking: Types.ObjectId;
  sender: Types.ObjectId;
  receiver: Types.ObjectId;
  content: string;
  contentType: 'text' | 'image' | 'location';
  isRead: boolean;
  readAt?: Date;
  clientMsgId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, maxlength: 2000 },
    contentType: {
      type: String,
      enum: ['text', 'image', 'location'],
      default: 'text',
    },
    isRead: { type: Boolean, default: false },
    readAt: Date,
    clientMsgId: { type: String, sparse: true, unique: true },
  },
  {
    timestamps: true,
    toJSON: { transform(_doc, ret) { delete (ret as Record<string, unknown>).__v; return ret; } },
  },
);

// TTL index: auto-delete messages after 90 days
MessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
MessageSchema.index({ booking: 1, createdAt: 1 });
MessageSchema.index({ receiver: 1, isRead: 1 });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
