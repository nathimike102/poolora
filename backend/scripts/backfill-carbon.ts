/**
 * Measures the CO₂ saved by bookings completed before carbon was counted
 * (UC-R11), and adds it to each rider's and driver's totals. Safe to run
 * again: bookings already measured are skipped.
 *
 * Run: npm run backfill:carbon (from backend/)
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { CarbonService } from '../src/services/CarbonService';

dotenv.config();

if (require.main === module) {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/mobility';
  mongoose
    .connect(uri, { serverSelectionTimeoutMS: 8000 })
    .then(async () => {
      console.log('Measuring the CO₂ saved by past bookings…');
      const { measured } = await new CarbonService().backfill();
      console.log(`Done: ${measured} booking${measured === 1 ? '' : 's'} measured.`);
      await mongoose.disconnect();
    })
    .catch(async (error) => {
      console.error('Backfill failed:', (error as Error).message);
      await mongoose.disconnect();
      process.exit(1);
    });
}
