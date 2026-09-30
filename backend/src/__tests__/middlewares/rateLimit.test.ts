/**
 * Rate limits are keyed by what they protect. Many mobile users share one
 * public IP (carrier-grade NAT), so a phone number's limit must not be
 * spent by other people on the same IP, and signed callbacks are exempt.
 */
jest.mock('../../config/redis', () => ({ getRedisClient: () => null }));

import type { Request, Response } from 'express';
import { globalRateLimit, otpRateLimit, checkUserRateLimit } from '../../middlewares/rateLimit.middleware';
import { config } from '../../config';

type Mw = (req: Request, res: Response, next: (e?: unknown) => void) => Promise<void>;
const run = async (mws: Mw | Mw[], req: Partial<Request>) => {
  let error: unknown;
  for (const mw of ([] as Mw[]).concat(mws)) {
    await mw(req as Request, {} as Response, (e?: unknown) => { error ??= e; });
    if (error) break;
  }
  return error as { statusCode?: number } | undefined;
};

it('limits codes per phone number, not per shared IP', async () => {
  const ip = '41.60.0.1'; // one carrier NAT address
  for (let i = 0; i < config.rateLimit.otp.max; i++) {
    expect(await run(otpRateLimit as Mw[], { ip, body: { phone: '0771000001' }, originalUrl: '/auth/send-otp' })).toBeUndefined();
  }
  // The same number in another format is the same number
  expect(await run(otpRateLimit as Mw[], { ip, body: { phone: '+263 77 100 0001' }, originalUrl: '/auth/send-otp' })).toMatchObject({ statusCode: 429 });
  // Someone else behind the same IP can still sign in
  expect(await run(otpRateLimit as Mw[], { ip, body: { phone: '0771000002' }, originalUrl: '/auth/send-otp' })).toBeUndefined();
});

it('lets Paynow callbacks through whatever the IP has used', async () => {
  const ip = '196.2.0.9';
  for (let i = 0; i < config.rateLimit.global.max; i++) await run(globalRateLimit as Mw, { ip, originalUrl: '/rides' });
  expect(await run(globalRateLimit as Mw, { ip, originalUrl: '/rides' })).toMatchObject({ statusCode: 429 });
  expect(await run(globalRateLimit as Mw, { ip, originalUrl: '/payments/paynow/result' })).toBeUndefined();
});

it('limits each signed-in user separately', async () => {
  for (let i = 0; i < config.rateLimit.user.max; i++) await checkUserRateLimit('user-a');
  await expect(checkUserRateLimit('user-a')).rejects.toMatchObject({ statusCode: 429 });
  await expect(checkUserRateLimit('user-b')).resolves.toBeUndefined();
});
