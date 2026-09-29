/**
 * A database from the Razorpay days: its unique index on
 * payments.razorpayOrderId rejects the second Paynow payment until the
 * migration drops it, and old records move onto the new fields.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { migrateToPaynow } from '../migrations/migrateToPaynow';

jest.setTimeout(60_000);
let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

it('drops the Razorpay indexes and moves old records to the Paynow fields', async () => {
  const db = mongoose.connection.db!;
  const payments = db.collection('payments');
  await payments.createIndex({ razorpayOrderId: 1 }, { unique: true });
  await payments.insertOne({ booking: new Types.ObjectId(), amount: 180, currency: 'INR', method: 'upi', razorpayOrderId: 'order_1', razorpayPaymentId: 'pay_1' });
  await payments.insertOne({ reference: 'BK-a-1', amount: 3 });
  await expect(payments.insertOne({ reference: 'BK-b-1', amount: 3 })).rejects.toThrow('duplicate key');

  const bookings = db.collection('bookings');
  await bookings.insertMany([{ razorpayOrderId: 'order_1' }, { status: 'confirmed' }]);
  await db.collection('parcelpoolings').insertOne({ paymentMethod: 'razorpay', paymentStatus: 'authorized', razorpayOrderId: 'order_p' });

  await migrateToPaynow(db);
  await migrateToPaynow(db); // a second run changes nothing

  await payments.insertOne({ reference: 'BK-b-1', amount: 3 });
  expect(await payments.findOne({ reference: 'order_1' })).toMatchObject({ paynowReference: 'pay_1', method: 'ecocash', currency: 'USD' });
  expect((await payments.findOne({ reference: 'order_1' }))?.razorpayOrderId).toBeUndefined();
  expect((await bookings.find().toArray()).map((b) => b.paymentMethod).sort()).toEqual(['online', 'wallet']);
  expect(await db.collection('parcelpoolings').findOne({})).toMatchObject({ paymentMethod: 'online', paymentStatus: 'unpaid' });
});
