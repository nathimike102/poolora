/**
 * Moves every account to the rating score that starts at 5 and lets no single
 * rating sink anyone (utils/ratingScore). Run once after deploying it. Safe to
 * run again: accounts already moved are skipped.
 *
 * Run: npm run backfill:ratings (from backend/)
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { backfillRatingScores } from '../src/utils/ratingScore';

dotenv.config();

if (require.main === module) {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/mobility';
  mongoose
    .connect(uri, { serverSelectionTimeoutMS: 8000 })
    .then(async () => {
      console.log('Moving accounts to the new rating score…');
      const updated = await backfillRatingScores();
      console.log(`Done: ${updated} rating${updated === 1 ? '' : 's'} moved.`);
      await mongoose.disconnect();
    })
    .catch(async (error) => {
      console.error('Backfill failed:', (error as Error).message);
      await mongoose.disconnect();
      process.exit(1);
    });
}
