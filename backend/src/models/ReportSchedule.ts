import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * A report emailed on a schedule (UC-A06). Each run covers the period just
 * ended (yesterday, the last seven days, or last month) and goes out at 07:00
 * India time with one attachment per report. See services/ReportScheduleService.ts.
 */
export interface IReportSchedule extends Document {
  _id: Types.ObjectId;
  name: string;
  types: Array<'users' | 'rides' | 'financial' | 'performance' | 'safety'>;
  frequency: 'daily' | 'weekly' | 'monthly';
  format: 'csv' | 'xlsx' | 'pdf';
  recipients: string[];
  active: boolean;
  createdBy: Types.ObjectId;
  nextRunAt: Date;
  lastSentAt?: Date;
  /** Why the last run failed; cleared by the next success */
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReportScheduleSchema = new Schema<IReportSchedule>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    types: { type: [String], enum: ['users', 'rides', 'financial', 'performance', 'safety'], required: true },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true },
    format: { type: String, enum: ['csv', 'xlsx', 'pdf'], default: 'xlsx' },
    recipients: { type: [String], required: true },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    nextRunAt: { type: Date, required: true },
    lastSentAt: Date,
    lastError: String,
  },
  { timestamps: true },
);

ReportScheduleSchema.index({ active: 1, nextRunAt: 1 });

export const ReportSchedule = mongoose.model<IReportSchedule>('ReportSchedule', ReportScheduleSchema);
