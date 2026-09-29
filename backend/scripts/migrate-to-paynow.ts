/**
 * Moves a database from Razorpay to Paynow. See src/migrations/migrateToPaynow.ts.
 *
 * Run: npm run migrate:paynow (from backend/)
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { migrateToPaynow } from '../src/migrations/migrateToPaynow';

dotenv.config();

if (require.main === module) {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/mobility';
  mongoose
    .connect(uri, { serverSelectionTimeoutMS: 8000 })
    .then(async () => {
      console.log('Moving the database from Razorpay to Paynow…');
      await migrateToPaynow(mongoose.connection.db!);
      console.log('Done.');
      await mongoose.disconnect();
    })
    .catch(async (error) => {
      console.error('Migration failed:', (error as Error).message);
      await mongoose.disconnect();
      process.exit(1);
    });
}
