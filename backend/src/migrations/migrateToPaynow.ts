/**
 * migrateToPaynow.ts — moves a database from the Razorpay fields to Paynow.
 *
 * Mongoose creates the new indexes but never drops old ones, and the old
 * unique index on payments.razorpayOrderId would reject every Paynow payment
 * after the first. This drops the Razorpay indexes and moves old records onto
 * the new fields. Safe to run more than once. Run it with
 * `npm run migrate:paynow`; the seed runs it too.
 */

import type mongoose from 'mongoose';
import { logger } from '../utils/logger';

type Db = NonNullable<typeof mongoose.connection.db>;

/** Drops every index on the collection that covers a Razorpay field */
async function dropRazorpayIndexes(db: Db, name: string): Promise<string[]> {
  const exists = await db.listCollections({ name }).hasNext();
  if (!exists) return [];
  const collection = db.collection(name);
  const dropped: string[] = [];
  for (const index of await collection.indexes()) {
    if (index.name && Object.keys(index.key).some((k) => k.toLowerCase().startsWith('razorpay'))) {
      await collection.dropIndex(index.name);
      dropped.push(index.name);
    }
  }
  return dropped;
}

export async function migrateToPaynow(db: Db): Promise<void> {
  for (const name of ['payments', 'bookings', 'parcelpoolings', 'wallettransactions']) {
    const dropped = await dropRazorpayIndexes(db, name);
    if (dropped.length) logger.info('Dropped Razorpay indexes', { collection: name, indexes: dropped });
  }

  // Bookings: an order id meant an online payment
  const bookings = db.collection('bookings');
  await bookings.updateMany({ paymentMethod: { $exists: false }, razorpayOrderId: { $nin: [null, ''] } }, { $set: { paymentMethod: 'online' } });
  await bookings.updateMany({ paymentMethod: { $exists: false } }, { $set: { paymentMethod: 'wallet' } });
  await bookings.updateMany({}, { $unset: { razorpayOrderId: '', razorpayPaymentId: '' } });

  // Parcels
  const parcels = db.collection('parcelpoolings');
  await parcels.updateMany({ paymentMethod: 'razorpay' }, { $set: { paymentMethod: 'online' } });
  await parcels.updateMany({ paymentStatus: 'authorized' }, { $set: { paymentStatus: 'unpaid' } });
  await parcels.updateMany({}, { $unset: { razorpayOrderId: '', razorpayPaymentId: '' } });

  // Payments: the order id becomes the reference; old methods map to the nearest new one
  const payments = db.collection('payments');
  await payments.updateMany({ reference: { $exists: false }, razorpayOrderId: { $exists: true } }, [{ $set: { reference: '$razorpayOrderId' } }]);
  await payments.updateMany({ paynowReference: { $exists: false }, razorpayPaymentId: { $exists: true } }, [{ $set: { paynowReference: '$razorpayPaymentId' } }]);
  await payments.updateMany({ method: { $in: ['upi', 'netbanking'] } }, { $set: { method: 'ecocash' } });
  await payments.updateMany({ currency: 'INR' }, { $set: { currency: 'USD' } });
  await payments.updateMany({}, { $unset: { razorpayOrderId: '', razorpayPaymentId: '', razorpaySignature: '' } });

  // Wallet ledger
  const ledger = db.collection('wallettransactions');
  await ledger.updateMany({ gatewayReference: { $exists: false }, razorpayOrderId: { $exists: true } }, [{ $set: { gatewayReference: '$razorpayOrderId' } }]);
  await ledger.updateMany({}, { $unset: { razorpayOrderId: '', razorpayPaymentId: '', razorpaySignature: '' } });
}
