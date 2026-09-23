import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * Every admin action, with who did it, to what, and why (UC-A01 step 7,
 * UC-A05 step 5, UC-A07 step 8). Entries are never edited or deleted.
 */
export interface IAdminAuditLog extends Document {
  _id: Types.ObjectId;
  actor: Types.ObjectId;
  action: string;
  targetType: 'user' | 'kyc' | 'dispute' | 'sos' | 'settings';
  targetId?: string;
  reason?: string;
  details?: Record<string, unknown>;
  createdAt: Date;
}

const AdminAuditLogSchema = new Schema<IAdminAuditLog>(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true, index: true },
    targetType: { type: String, enum: ['user', 'kyc', 'dispute', 'sos', 'settings'], required: true },
    targetId: { type: String, index: true },
    reason: String,
    details: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

AdminAuditLogSchema.index({ createdAt: -1 });

export const AdminAuditLog = mongoose.model<IAdminAuditLog>('AdminAuditLog', AdminAuditLogSchema);
