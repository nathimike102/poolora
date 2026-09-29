/**
 * SettingsService.ts
 *
 * Platform settings an admin can change without a deploy (UC-A07). Each
 * setting reads and writes a value in `config`, which the rest of the backend
 * already reads at the moment it needs it, so a change applies immediately.
 * Changed values are stored in MongoDB and re-read every minute, so every
 * backend instance picks them up. Only settings wired into the code are
 * listed; payment credentials and message templates stay out of reach on
 * purpose.
 */

import { config } from '../config';
import { PlatformSettings } from '../models/PlatformSettings';
import { AdminAuditLog } from '../models/AdminAuditLog';
import { SettingsChangeRequest } from '../models/SettingsChangeRequest';
import { Types } from 'mongoose';
import { AppError, NotFoundError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { audit } from './AuditService';

type Group = 'fees' | 'cancellation' | 'safety' | 'matching' | 'rules';

export interface SettingDefinition {
  key: string;
  group: Group;
  label: string;
  help: string;
  /** 'percent' values are stored as fractions (0.15) and shown as 15% */
  unit: 'percent' | 'minutes' | 'hours' | 'seconds' | 'km' | 'meters' | 'count' | 'weights' | 'tiers' | 'boolean' | 'zwgPerUsd';
  /** Money settings: a change applies only after a second admin approves it */
  critical?: boolean;
  min?: number;
  max?: number;
  read: () => unknown;
  write: (value: unknown) => void;
}

// config is declared `as const` for type safety; these few values are
// deliberately changed at runtime, and only here.
const mutable = config as unknown as {
  zwgPerUsd: number;
  ride: Record<string, unknown>;
  tracking: Record<string, unknown>;
  safety: { checkInSeconds: Record<string, number> };
  matching: { weights: Record<string, number> };
};

function numberSetting(
  key: string,
  group: Group,
  label: string,
  help: string,
  unit: SettingDefinition['unit'],
  min: number,
  max: number,
  target: Record<string, unknown>,
  field: string,
): SettingDefinition {
  return { key, group, label, help, unit, min, max, read: () => target[field], write: (v) => { target[field] = v; } };
}

const WEIGHT_KEYS = ['proximity', 'time', 'rating', 'acceptance', 'safety'] as const;

export const SETTINGS: SettingDefinition[] = [
  { ...numberSetting('platformFeeRate', 'fees', 'Platform commission', 'Share of each fare the platform keeps. Applies to rides completed after the change.', 'percent', 0, 0.3, mutable.ride, 'platformFeeRate'), critical: true },
  {
    key: 'zwgPerUsd',
    group: 'fees',
    label: 'ZiG exchange rate',
    help: 'ZiG charged per US dollar when a rider chooses to pay in ZiG. Prices and wallets stay in US dollars. Set 0 to turn ZiG payments off. Use the RBZ interbank rate.',
    unit: 'zwgPerUsd',
    critical: true,
    min: 0,
    max: 1000,
    read: () => mutable.zwgPerUsd,
    write: (v) => { mutable.zwgPerUsd = Number(v); },
  },
  {
    key: 'keepPlatformFeeOnCancel',
    group: 'fees',
    label: 'Keep the platform fee when a rider cancels',
    help: 'On: a rider who cancels a confirmed seat never gets the platform fee back, even inside the full-refund window. Off: the fee is refunded along with the fare. Cancellations by drivers, and requests not yet accepted, are always refunded in full.',
    unit: 'boolean',
    critical: true,
    read: () => mutable.ride.keepPlatformFeeOnCancel,
    write: (v) => { mutable.ride.keepPlatformFeeOnCancel = v; },
  },
  {
    key: 'riderCancellationRefunds',
    group: 'cancellation',
    label: 'Rider cancellation refunds',
    help: 'Share of the fare returned when a rider cancels a confirmed seat, by hours left before departure. The first tier whose hours are met applies.',
    unit: 'tiers',
    critical: true,
    read: () => mutable.ride.riderCancellationRefunds,
    write: (v) => { mutable.ride.riderCancellationRefunds = v; },
  },
  numberSetting('paymentTimeoutMins', 'cancellation', 'Payment time limit', 'Requests paid online (EcoCash, OneMoney, InnBucks, card) still unpaid after this are cancelled.', 'minutes', 5, 60, mutable.ride, 'paymentTimeoutMins'),
  numberSetting('requestExpiryHours', 'cancellation', 'Driver response time', 'Requests the driver has not answered after this expire with a full refund.', 'hours', 1, 24, mutable.ride, 'requestExpiryHours'),
  numberSetting('emptyRideCancelMins', 'cancellation', 'Cancel empty rides before departure', 'Rides nobody has booked are cancelled this long before they leave.', 'minutes', 15, 240, mutable.ride, 'emptyRideCancelMins'),
  numberSetting('routeDeviationMeters', 'safety', 'Route deviation alert', 'The rider, driver and admins are alerted when the car is further than this from the planned route.', 'meters', 100, 5000, mutable.tracking, 'routeDeviationMeters'),
  numberSetting('safetyCheckInMins', 'safety', 'In-ride safety check-in', 'Riders in the car are asked "Are you OK?" this often. Two unanswered prompts raise an SOS.', 'minutes', 10, 120, mutable.ride, 'safetyCheckInMins'),
  numberSetting('noShowWaitMins', 'cancellation', 'No-show wait', 'How long a driver waits at the pickup before they can report a no-show.', 'minutes', 5, 30, mutable.ride, 'noShowWaitMins'),
  numberSetting('sosCheckInLow', 'safety', 'SOS check-in, low risk', 'Time between check-in prompts during an SOS at low risk.', 'seconds', 30, 600, mutable.safety.checkInSeconds, 'low'),
  numberSetting('sosCheckInMedium', 'safety', 'SOS check-in, medium risk', 'Time between check-in prompts at medium risk.', 'seconds', 30, 600, mutable.safety.checkInSeconds, 'medium'),
  numberSetting('sosCheckInHigh', 'safety', 'SOS check-in, high risk', 'Time between check-in prompts at high risk.', 'seconds', 15, 300, mutable.safety.checkInSeconds, 'high'),
  {
    key: 'matchingWeights',
    group: 'matching',
    label: 'Match score weights',
    help: 'How much each factor counts when ranking search results. They must add up to 100%.',
    unit: 'weights',
    read: () => ({ ...mutable.matching.weights }),
    write: (v) => { Object.assign(mutable.matching.weights, v); },
  },
  numberSetting('maxPickupDistanceFromRouteKm', 'matching', 'Distance from the route', 'How far from a ride\'s route a rider may be picked up or dropped.', 'km', 0.5, 10, mutable.ride, 'maxPickupDistanceFromRouteKm'),
  numberSetting('defaultSearchRadiusKm', 'matching', 'Default search radius', 'Used when the app does not send its own radius.', 'km', 1, 50, mutable.ride, 'defaultSearchRadiusKm'),
  numberSetting('defaultTimeDeviationMins', 'matching', 'Default time window', 'How far either side of the requested time a ride may leave.', 'minutes', 15, 480, mutable.ride, 'defaultTimeDeviationMins'),
  numberSetting('maxActivePerDriver', 'rules', 'Active rides per driver', 'Upcoming rides a driver may have at once.', 'count', 1, 20, mutable.ride, 'maxActivePerDriver'),
  numberSetting('maxPendingRequestsPerRider', 'rules', 'Open requests per rider', 'Unanswered requests a rider may have at once.', 'count', 1, 10, mutable.ride, 'maxPendingRequestsPerRider'),
];

const byKey = new Map(SETTINGS.map((s) => [s.key, s]));
const defaults = new Map(SETTINGS.map((s) => [s.key, structuredClone(s.read())]));

/** Checks a proposed value; returns the cleaned value or throws a 422. */
function validate(def: SettingDefinition, value: unknown): unknown {
  const fail = (msg: string): never => {
    throw new AppError(`${def.label}: ${msg}`, 422, 'VALIDATION_ERROR');
  };
  if (def.unit === 'weights') {
    const w = value as Record<string, unknown>;
    if (!w || typeof w !== 'object') fail('expected a set of weights');
    const clean: Record<string, number> = {};
    for (const k of WEIGHT_KEYS) {
      const n = Number(w[k]);
      if (!Number.isFinite(n) || n < 0 || n > 1) fail(`${k} must be between 0 and 100%`);
      clean[k] = n;
    }
    const sum = Object.values(clean).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > 0.001) fail(`the weights add up to ${Math.round(sum * 100)}%, not 100%`);
    return clean;
  }
  if (def.unit === 'boolean') {
    if (typeof value !== 'boolean') fail('expected on or off');
    return value;
  }
  if (def.unit === 'tiers') {
    if (!Array.isArray(value) || value.length < 1 || value.length > 6) fail('expected 1 to 6 tiers');
    const tiers = (value as Array<Record<string, unknown>>).map((t) => ({
      minHours: Number(t.minHours),
      refundRate: Number(t.refundRate),
    }));
    for (const t of tiers) {
      if (!Number.isFinite(t.minHours) || t.minHours < 0 || t.minHours > 168) fail('hours must be between 0 and 168');
      if (!Number.isFinite(t.refundRate) || t.refundRate < 0 || t.refundRate > 1) fail('refunds must be between 0 and 100%');
    }
    tiers.sort((a, b) => b.minHours - a.minHours);
    if (tiers[tiers.length - 1].minHours !== 0) fail('the last tier must start at 0 hours, so every cancellation has a refund rule');
    for (let i = 1; i < tiers.length; i++) {
      if (tiers[i].minHours === tiers[i - 1].minHours) fail('two tiers start at the same hour');
      if (tiers[i].refundRate > tiers[i - 1].refundRate) fail('a later cancellation cannot refund more than an earlier one');
    }
    return tiers;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) fail('expected a number');
  if (def.min !== undefined && n < def.min) fail(`must be at least ${def.min}`);
  if (def.max !== undefined && n > def.max) fail(`must be at most ${def.max}`);
  if (def.unit === 'count' && !Number.isInteger(n)) fail('must be a whole number');
  return n;
}

let refreshTimer: NodeJS.Timeout | null = null;

/** How long a held change waits for a second admin */
const APPROVAL_WINDOW_MS = 24 * 3_600_000;

export class SettingsService {
  /** Current value, default and limits of every setting. */
  static list() {
    return SETTINGS.map((s) => ({
      key: s.key,
      group: s.group,
      label: s.label,
      help: s.help,
      unit: s.unit,
      critical: Boolean(s.critical),
      min: s.min,
      max: s.max,
      value: s.read(),
      defaultValue: defaults.get(s.key),
    }));
  }

  /** Reads stored changes into config. Called at startup and every minute. */
  static async load(): Promise<void> {
    const doc = await PlatformSettings.findById('platform').lean();
    for (const def of SETTINGS) {
      const stored = doc?.values?.[def.key];
      try {
        def.write(stored === undefined ? structuredClone(defaults.get(def.key)) : validate(def, stored));
      } catch (error) {
        logger.error('Ignoring an invalid stored setting', { key: def.key, error: (error as Error).message });
      }
    }
  }

  static startRefresh(intervalMs = 60_000): void {
    if (refreshTimer) return;
    refreshTimer = setInterval(() => {
      SettingsService.load().catch((error) => logger.warn('Settings refresh failed', { error: (error as Error).message }));
    }, intervalMs);
    refreshTimer.unref();
  }

  /**
   * Validates several changes at once. Nothing is changed unless every value
   * is valid. Changes to critical settings (fees and refunds) are held for a
   * second admin; the rest apply immediately. The audit entry keeps the old
   * values for revert.
   */
  static async update(changes: Record<string, unknown>, adminId: string, reason: string) {
    if (!reason?.trim()) throw new AppError('Say why the settings are changing', 422, 'VALIDATION_ERROR');
    const cleaned = SettingsService.clean(changes);
    const critical = Object.keys(cleaned).filter((k) => byKey.get(k)!.critical);
    if (critical.length) {
      await SettingsService.expireOld();
      const open = await SettingsChangeRequest.findOne({ status: 'pending', ...Object.fromEntries(critical.map((k) => [`changes.${k}`, { $exists: true }])) }).lean();
      if (open) throw new AppError('A change to these settings is already waiting for approval', 409, 'CHANGE_PENDING');
      const pending = await SettingsChangeRequest.create({
        changes: Object.fromEntries(critical.map((k) => [k, cleaned[k]])),
        reason: reason.trim(),
        requestedBy: new Types.ObjectId(adminId),
        expiresAt: new Date(Date.now() + APPROVAL_WINDOW_MS),
      });
      await audit(adminId, 'settings.request', 'settings', pending._id.toString(), reason, { changes: pending.changes });
      for (const k of critical) delete cleaned[k];
    }
    if (Object.keys(cleaned).length) await SettingsService.apply(cleaned, adminId, reason);
    return SettingsService.list();
  }

  /** Changes waiting for a second admin */
  static async pending() {
    await SettingsService.expireOld();
    return SettingsChangeRequest.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .populate('requestedBy', 'name email phone')
      .lean();
  }

  /** A second admin approves a held change; it is checked again and applied. */
  static async approve(requestId: string, adminId: string, note?: string) {
    const request = await SettingsService.openRequest(requestId);
    if (request.requestedBy.toString() === adminId) {
      throw new AppError('Another admin must approve this change', 403, 'SECOND_ADMIN_REQUIRED');
    }
    const cleaned = SettingsService.clean(request.changes);
    const claimed = await SettingsChangeRequest.findOneAndUpdate(
      { _id: request._id, status: 'pending' },
      { $set: { status: 'approved', decidedBy: new Types.ObjectId(adminId), decidedAt: new Date(), decisionNote: note } },
    );
    if (!claimed) throw new AppError('This change has already been decided', 409, 'CONFLICT');
    await SettingsService.apply(cleaned, adminId, request.reason, { requestedBy: request.requestedBy.toString(), requestId });
    return SettingsService.list();
  }

  static async reject(requestId: string, adminId: string, note?: string) {
    const request = await SettingsService.openRequest(requestId);
    await SettingsChangeRequest.updateOne(
      { _id: request._id, status: 'pending' },
      { $set: { status: 'rejected', decidedBy: new Types.ObjectId(adminId), decidedAt: new Date(), decisionNote: note } },
    );
    await audit(adminId, 'settings.reject', 'settings', requestId, note, { changes: request.changes });
    return { rejected: true };
  }

  private static clean(changes: Record<string, unknown>): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(changes ?? {})) {
      const def = byKey.get(key);
      if (!def) throw new AppError(`Unknown setting: ${key}`, 422, 'VALIDATION_ERROR');
      cleaned[key] = validate(def, value);
    }
    if (Object.keys(cleaned).length === 0) throw new AppError('Nothing to change', 422, 'VALIDATION_ERROR');
    return cleaned;
  }

  private static async apply(cleaned: Record<string, unknown>, adminId: string, reason: string, extra: Record<string, unknown> = {}) {
    const before: Record<string, unknown> = {};
    for (const key of Object.keys(cleaned)) before[key] = structuredClone(byKey.get(key)!.read());

    const set = Object.fromEntries(Object.entries(cleaned).map(([k, v]) => [`values.${k}`, v]));
    await PlatformSettings.updateOne({ _id: 'platform' }, { $set: set }, { upsert: true });
    for (const [key, value] of Object.entries(cleaned)) byKey.get(key)!.write(value);

    await audit(adminId, 'settings.update', 'settings', 'platform', reason, { before, after: cleaned, ...extra });
  }

  private static async openRequest(requestId: string) {
    if (!Types.ObjectId.isValid(requestId)) throw new NotFoundError('Settings change');
    await SettingsService.expireOld();
    const request = await SettingsChangeRequest.findById(requestId).lean();
    if (!request) throw new NotFoundError('Settings change');
    if (request.status !== 'pending') throw new AppError(`This change was already ${request.status}`, 409, 'CONFLICT');
    return request;
  }

  private static async expireOld() {
    await SettingsChangeRequest.updateMany({ status: 'pending', expiresAt: { $lte: new Date() } }, { $set: { status: 'expired' } });
  }

  /** Recent changes, newest first. */
  static async history(limit = 50) {
    return AdminAuditLog.find({ targetType: 'settings', action: 'settings.update' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('actor', 'name email phone')
      .lean();
  }

  /** Puts back the values a change replaced, within 24 hours of it. */
  static async revert(auditId: string, adminId: string, reason: string) {
    const entry = await AdminAuditLog.findOne({ _id: auditId, targetType: 'settings', action: 'settings.update' }).lean();
    if (!entry) throw new NotFoundError('Settings change');
    if (Date.now() - new Date(entry.createdAt).getTime() > 24 * 3600_000) {
      throw new AppError('Changes can only be reverted within 24 hours', 409, 'REVERT_TOO_LATE');
    }
    const before = (entry.details as { before?: Record<string, unknown> } | undefined)?.before;
    if (!before) throw new AppError('This change has nothing to revert', 409, 'CONFLICT');
    return SettingsService.update(before, adminId, reason || `Revert of change ${auditId}`);
  }
}
