/**
 * One-off maintenance script to cleanup expired SOS tokens and expired emergency records.
 * Run with: ts-node backend/scripts/cleanup-sos.ts
 */
import mongoose from 'mongoose';
import { config } from '../src/config';
import { EmergencyToken } from '../src/models/EmergencyToken';
import { EmergencyRecord } from '../src/models/EmergencyRecord';

async function main() {
  await mongoose.connect(config.mongo.uri, { dbName: config.mongo.dbName });
  console.log('Connected to MongoDB');

  const now = new Date();

  // Remove expired tokens
  const tokenRes = await EmergencyToken.deleteMany({ expiresAt: { $lte: now } });
  console.log('Removed expired emergency tokens:', tokenRes.deletedCount);

  // Remove resolved/false alarm records where retention has expired
  const recordRes = await EmergencyRecord.deleteMany({
    status: { $in: ['resolved', 'false_alarm'] },
    retentionExpiresAt: { $lte: now },
  });
  console.log('Removed expired emergency records:', recordRes.deletedCount);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
