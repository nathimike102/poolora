/**
 * facts.ts
 *
 * Prints, as JSON, the numbers the decks and PDFs quote, read from the
 * backend's own code, so the documents cannot drift from the product.
 * Run from backend/ (npm run facts in this folder does that):
 *
 *   npx ts-node --transpile-only -P tsconfig.json ../Doc/presentation/source/facts.ts > ../Doc/presentation/source/facts.json
 *
 * Test counts come from Jest's --json output when TEST_JSON names the files
 * (comma-separated); otherwise they are left out.
 */
/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';

// The config module insists on these; nothing here connects to anything
process.env.MONGO_URI ||= 'mongodb://unused';
process.env.JWT_ACCESS_SECRET ||= 'x'.repeat(32);
process.env.JWT_REFRESH_SECRET ||= 'y'.repeat(32);
process.env.LOG_LEVEL = 'error';

/* eslint-disable @typescript-eslint/no-var-requires */
const root = path.resolve(__dirname, '../../..');
const backend = path.join(root, 'backend/src');
const { config } = require(path.join(backend, 'config'));
const { REGION, money } = require(path.join(backend, 'config/region'));
const { holidaysIn } = require(path.join(backend, 'utils/holidays'));
const { PRICE_RULES, RATE_PER_KM, PricingService } = require(path.join(backend, 'services/PricingService'));
const { MAX_SEATS_BY_VEHICLE } = require(path.join(backend, 'types'));
const { WITHDRAWAL_RULES } = require(path.join(backend, 'services/WithdrawalService'));

/** RideService pulls in the whole backend; its limits are read from the source instead */
function rideLimits() {
  const src = fs.readFileSync(path.join(backend, 'services/RideService.ts'), 'utf8');
  const num = (name: string) => Number(new RegExp(`const ${name} = (\\d+)`).exec(src)?.[1]);
  return { minAdvanceHours: num('MIN_ADVANCE_HOURS'), maxRideKm: num('MAX_RIDE_KM'), maxStops: num('MAX_STOPS') };
}

/** Routes, counted from the router files: router.get/post/put/patch/delete(... */
function routeCount(): number {
  const dir = path.join(backend, 'routes');
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && f !== 'index.ts')
    .reduce((n, f) => n + (fs.readFileSync(path.join(dir, f), 'utf8').match(/\brouter\.(get|post|put|patch|delete)\(/g)?.length ?? 0), 0);
}

/** Lines of source per component, tests excluded */
function linesOfCode() {
  const count = (dir: string, exts: string[]): number =>
    fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return e.name === '__tests__' || e.name === 'node_modules' ? n : n + count(full, exts);
      return exts.some((x) => e.name.endsWith(x)) ? n + fs.readFileSync(full, 'utf8').split('\n').length : n;
    }, 0);
  return {
    backend: count(path.join(root, 'backend/src'), ['.ts']),
    app: count(path.join(root, 'frontend/src'), ['.ts', '.tsx']),
    admin: count(path.join(root, 'admin-web/src'), ['.ts', '.tsx']),
    website: count(path.join(root, 'web-landing/src'), ['.ts', '.tsx']),
    ml: count(path.join(root, 'ml-service/app'), ['.py']),
  };
}

function tests() {
  if (!process.env.TEST_JSON) return undefined;
  const out: Record<string, { suites: number; tests: number; passed: number }> = {};
  for (const entry of process.env.TEST_JSON.split(',')) {
    const [name, file] = entry.split('=');
    const r = JSON.parse(fs.readFileSync(file, 'utf8'));
    out[name] = { suites: r.numTotalTestSuites, tests: r.numTotalTests, passed: r.numPassedTests };
  }
  return out;
}

(async () => {
  const pricing = new PricingService();
  // Keep the forecast out of it: examples show the plain rate
  pricing.surgeFor = async () => 1;
  // A Tuesday mid-morning, Harare time: no commute uplift
  const offPeak = new Date('2026-10-06T09:00:00Z');
  const example = async (distanceKm: number, vehicleType: string) => {
    const s = await pricing.suggest({ distanceKm, vehicleType, departureTime: offPeak, pickup: REGION.center });
    return { distanceKm, vehicleType, suggested: s.suggested, min: s.min, max: s.max };
  };

  const year = new Date().getFullYear();
  const facts = {
    generatedAt: new Date().toISOString(),
    market: {
      country: REGION.countryName,
      currency: REGION.currency,
      timeZone: REGION.timeZone,
      dialCode: REGION.dialCode,
      emergency: REGION.emergency,
      holidays: holidaysIn(year, REGION.holidays),
    },
    pricing: {
      rules: PRICE_RULES,
      ratePerKm: RATE_PER_KM,
      examples: [
        await example(15, 'sedan'),
        await example(15, 'auto'),
        await example(15, 'bike'),
        await example(439, 'sedan'),
        await example(439, 'minivan'),
        await example(263, 'sedan'),
      ],
      platformFeeRate: config.ride.platformFeeRate,
    },
    cancellation: {
      tiers: config.ride.riderCancellationRefunds,
      freeCancelMins: config.ride.riderFreeCancelMins,
      freeCancelLeadMins: config.ride.riderFreeCancelLeadMins,
      keepPlatformFeeOnCancel: config.ride.keepPlatformFeeOnCancel,
      noShowWaitMins: config.ride.noShowWaitMins,
      paymentTimeoutMins: config.ride.paymentTimeoutMins,
      requestExpiryHours: config.ride.requestExpiryHours,
    },
    rides: { ...rideLimits(), maxSeatsByVehicle: MAX_SEATS_BY_VEHICLE },
    matchingWeights: config.matching.weights,
    withdrawals: WITHDRAWAL_RULES,
    coinToUsdRate: config.wallet.coinToUsdRate,
    supportBotModel: process.env.SUPPORT_BOT_MODEL || 'claude-opus-5-5',
    api: { routes: routeCount() },
    models: fs.readdirSync(path.join(backend, 'models')).filter((f) => f.endsWith('.ts')).length,
    linesOfCode: linesOfCode(),
    tests: tests(),
    formatted: { minimumSeatPrice: money(PRICE_RULES.minimumSeatPrice) },
  };
  console.log(JSON.stringify(facts, null, 2));
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
