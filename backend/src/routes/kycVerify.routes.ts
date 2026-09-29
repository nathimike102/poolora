import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { DocumentCheckService } from '../services/DocumentCheckService';
import { config } from '../config';

/**
 * POST /kyc-verify/callback — the background-check vendor's later answer
 * (UC-A01). Body: { reference: <user id>, status, summary? }. The vendor
 * proves itself with the shared key in X-Kyc-Verify-Key.
 */
const router = Router();
const checks = new DocumentCheckService();

router.post('/callback', async (req: Request, res: Response) => {
  const key = config.kycVerify.apiKey;
  const given = String(req.header('x-kyc-verify-key') ?? '');
  const ok = key && given.length === key.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(key));
  if (!ok) {
    res.status(403).end();
    return;
  }
  const userId = String(req.body?.reference ?? '');
  if (!Types.ObjectId.isValid(userId)) {
    res.status(422).json({ error: 'Unknown reference' });
    return;
  }
  await checks.recordVendorAnswer(userId, req.body ?? {});
  res.status(204).end();
});

export default router;
