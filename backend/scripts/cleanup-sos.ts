/**
 * Maintenance script: removes expired SOS tracking tokens, and false alarms
 * past their retention (90 days). Resolved incidents are never removed.
 * Run with: ts-node backend/scripts/cleanup-sos.ts
 */
import mongoose from 'mongoose';
import { config } from '../src/config';
import { EmergencyToken } from '../src/models/EmergencyToken';
import { EmergencyRecord } from '../src/models/EmergencyRecord';
import { deleteSosEvidence } from '../src/services/UploadService';

async function main() {
  await mongoose.connect(config.mongo.uri, { dbName: config.mongo.dbName });
  console.log('Connected to MongoDB');

  const now = new Date();

  // Remove expired tokens
  const tokenRes = await EmergencyToken.deleteMany({ expiresAt: { $lte: now } });
  console.log('Removed expired emergency tokens:', tokenRes.deletedCount);

  // Remove false alarms whose retention has passed, with any recordings.
  // Real incidents are kept (UC-A03): the police may need them long after,
  // and older records still carry a 30-day date from before that rule.
  const expired = await EmergencyRecord.find({ status: 'false_alarm', retentionExpiresAt: { $lte: now } }).select('_id').lean();
  for (const { _id } of expired) await deleteSosEvidence(String(_id));
  const recordRes = await EmergencyRecord.deleteMany({ _id: { $in: expired.map((r) => r._id) } });
  console.log('Removed expired emergency records:', recordRes.deletedCount);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
