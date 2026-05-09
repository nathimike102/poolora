import mongoose, { Schema, Document, Types } from 'mongoose';

export interface INotification extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  title: string;
  message: string;
  type: 'chat' | 'ride' | 'system';
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      maxlength: 200,
    },

    message: {
      type: String,
      required: true,
      maxlength: 500,
    },

    type: {
      type: String,
      enum: ['chat', 'ride', 'system'],
      default: 'system',
    },

    data: {
      type: Schema.Types.Mixed,
      default: {},
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete (ret as any).__v;
        return ret;
      },
    },
  },
);

NotificationSchema.index({ user: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>(
  'Notification',
  NotificationSchema,
);