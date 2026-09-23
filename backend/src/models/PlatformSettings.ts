import mongoose, { Schema, Document } from 'mongoose';

/**
 * Admin-editable platform settings (UC-A07). One document, `_id: 'platform'`,
 * holding only the values an admin has changed; everything else keeps its
 * default from config. See services/SettingsService.ts for the list.
 */
export interface IPlatformSettings extends Document<string> {
  values: Record<string, unknown>;
  updatedAt: Date;
}

const PlatformSettingsSchema = new Schema<IPlatformSettings>(
  {
    _id: { type: String, default: 'platform' },
    values: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false },
);

export const PlatformSettings = mongoose.model<IPlatformSettings>('PlatformSettings', PlatformSettingsSchema);
