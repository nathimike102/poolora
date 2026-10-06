import crypto from 'crypto';
import mongoose, { Schema, Document } from 'mongoose';
import { config } from '../config';

/**
 * The phone numbers of closed accounts, remembered for a while so a person
 * cannot close and sign up again to get the new-user perks (a first-ride
 * offer and the like) a second time. Only a keyed hash of the number is kept,
 * never the number, and the record deletes itself when the time runs out.
 */
export interface IClosedPhone extends Document {
  phoneHash: string;
  closedAt: Date;
  expiresAt: Date;
}

const ClosedPhoneSchema = new Schema<IClosedPhone>({
  phoneHash: { type: String, required: true, unique: true },
  closedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
});

// MongoDB removes each record once its time is up
ClosedPhoneSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ClosedPhone = mongoose.model<IClosedPhone>('ClosedPhone', ClosedPhoneSchema);

/** Placeholders such as `firebase:<uid>` and `closed:<id>` are not phone numbers. */
const isRealPhone = (phone?: string): phone is string => !!phone && phone.startsWith('+');

const hashPhone = (phone: string) =>
  crypto.createHmac('sha256', config.accountClosure.phoneHashSecret).update(phone).digest('hex');

/** Remembers the number of an account being closed; closing again restarts the time. */
export async function rememberClosedPhone(phone: string | undefined, closedAt: Date): Promise<void> {
  if (!isRealPhone(phone)) return;
  const expiresAt = new Date(closedAt.getTime() + config.accountClosure.rememberPhoneDays * 86_400_000);
  await ClosedPhone.updateOne(
    { phoneHash: hashPhone(phone) },
    { $set: { closedAt, expiresAt } },
    { upsert: true },
  );
}

/** Whether this number belonged to an account closed recently enough to still count. */
export async function wasRecentlyClosed(phone: string | undefined): Promise<boolean> {
  if (!isRealPhone(phone)) return false;
  return !!(await ClosedPhone.exists({ phoneHash: hashPhone(phone), expiresAt: { $gt: new Date() } }));
}
