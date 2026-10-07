/**
 * AlertRuleService.ts
 *
 * Custom alert rules and SMS alerts to admins (UC-A02 step 4, UC-A06). An
 * admin picks a measure, above or below a threshold, who to tell, and how:
 * the dashboard always, email over SMTP, and SMS over Twilio. Rules are
 * checked every minute by jobs/AlertMonitor.ts. A rule that fires stays
 * quiet for its cooldown so a lasting problem does not flood phones.
 *
 * Measures are counts and rates the platform already keeps; "new" measures
 * count what arrived since the rule was last checked, so each new SOS can
 * page someone.
 */

import { Types } from 'mongoose';
import { AlertRule, IAlertRule } from '../models/AlertRule';
import { User } from '../models/User';
import { Booking } from '../models/Booking';
import { EmergencyRecord } from '../models/EmergencyRecord';
import { Dispute } from '../models/Dispute';
import { SupportTicket } from '../models/SupportTicket';
import { BookingStatus, FraudLevel, KYCStatus, SOSStatus, UserCapability } from '../types';
import { config } from '../config';
import { requestStats } from '../utils/requestStats';
import { AppError, NotFoundError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { audit } from './AuditService';
import { sendMail, mailEnabled, emailLayout, escapeHtml } from './Mailer';
import { NotificationService } from './NotificationService';
import { fromLocalClock, toLocalClock } from '../config/region';

const DAY = 86_400_000;
const MAX_RULES = 50;

function startOfToday(now: Date): Date {
  const local = toLocalClock(now);
  local.setUTCHours(0, 0, 0, 0);
  return fromLocalClock(local);
}

/** Share of today's expected bookings (from the last 7 days) that actually came, as a percent */
async function vsWeek(now: Date, filter: (from: Date, to?: Date) => Record<string, unknown>): Promise<number> {
  const today = startOfToday(now);
  const weekAgo = new Date(today.getTime() - 7 * DAY);
  const [todayCount, weekCount] = await Promise.all([
    Booking.countDocuments(filter(today)),
    Booking.countDocuments(filter(weekAgo, today)),
  ]);
  const expected = (weekCount / 7) * Math.max(1 / 24, (now.getTime() - today.getTime()) / DAY);
  return expected ? Math.round((todayCount / expected) * 100) : 0;
}

type Measure = { label: string; unit: 'count' | 'percent'; help: string; read: (ctx: { now: Date; since: Date }) => Promise<number> };

export const METRICS: Record<string, Measure> = {
  new_sos: {
    label: 'New SOS alerts',
    unit: 'count',
    help: 'SOS alerts raised since the last check (every minute). "Above 0" pages someone for every SOS.',
    read: ({ since }) => EmergencyRecord.countDocuments({ createdAt: { $gt: since } }),
  },
  active_sos: {
    label: 'Open SOS alerts',
    unit: 'count',
    help: 'SOS alerts not yet resolved.',
    read: () => EmergencyRecord.countDocuments({ status: { $in: [SOSStatus.TRIGGERED, SOSStatus.ACKNOWLEDGED] } }),
  },
  unacknowledged_sos_5m: {
    label: 'SOS waiting over 5 minutes',
    unit: 'count',
    help: 'SOS alerts nobody has taken for more than 5 minutes.',
    read: ({ now }) => EmergencyRecord.countDocuments({ status: SOSStatus.TRIGGERED, createdAt: { $lt: new Date(now.getTime() - 5 * 60_000) } }),
  },
  bookings_vs_week: {
    label: 'Bookings today, % of normal',
    unit: 'percent',
    help: 'Bookings so far today against the same time on an average day last week. "Below 50" catches a sudden drop.',
    read: ({ now }) => vsWeek(now, (from, to) => ({ createdAt: to ? { $gte: from, $lt: to } : { $gte: from } })),
  },
  cancellations_vs_week: {
    label: 'Cancellations today, % of normal',
    unit: 'percent',
    help: 'Booking cancellations so far today against an average day last week. "Above 200" catches a spike.',
    read: ({ now }) => vsWeek(now, (from, to) => ({ status: BookingStatus.CANCELLED, cancelledAt: to ? { $gte: from, $lt: to } : { $gte: from } })),
  },
  fraud_flags_today: {
    label: 'Fraud flags today',
    unit: 'count',
    help: 'Accounts the automatic fraud check flagged today.',
    read: ({ now }) => User.countDocuments({ fraudLevel: { $in: [FraudLevel.FLAGGED, FraudLevel.BLOCKED] }, fraudFlaggedAt: { $gte: startOfToday(now) } }),
  },
  urgent_support_open: {
    label: 'Urgent support requests waiting',
    unit: 'count',
    help: 'Safety and payment requests without a reply.',
    read: () => SupportTicket.countDocuments({ status: 'open', priority: 'urgent' }),
  },
  open_disputes: {
    label: 'Open disputes',
    unit: 'count',
    help: 'Disputes not yet decided.',
    read: () => Dispute.countDocuments({ status: { $ne: 'resolved' } }),
  },
  overdue_applications: {
    label: 'Driver applications over 48 hours',
    unit: 'count',
    help: 'Driver applications waiting more than two days.',
    read: ({ now }) => User.countDocuments({ 'kyc.status': KYCStatus.PENDING, 'kyc.submittedAt': { $lt: new Date(now.getTime() - 2 * DAY) } }),
  },
  server_error_rate: {
    label: 'Server errors, % of requests',
    unit: 'percent',
    help: 'Share of requests that failed with a server error in the last 5 minutes, on the server that runs the check.',
    read: async () => Math.round(requestStats().errorRate * 1000) / 10,
  },
};

interface RuleInput {
  name?: unknown;
  metric?: unknown;
  comparator?: unknown;
  threshold?: unknown;
  channels?: { email?: unknown; sms?: unknown };
  recipients?: unknown;
  cooldownMins?: unknown;
  active?: unknown;
}

const fires = (rule: Pick<IAlertRule, 'comparator' | 'threshold'>, value: number) =>
  rule.comparator === 'above' ? value > rule.threshold : value < rule.threshold;

export class AlertRuleService {
  private notifications = new NotificationService();

  metrics() {
    return {
      metrics: Object.entries(METRICS).map(([key, m]) => ({ key, label: m.label, unit: m.unit, help: m.help })),
      channels: { email: mailEnabled(), sms: Boolean(config.twilio.enabled && config.twilio.phoneNumber) },
    };
  }

  async list() {
    const rules = await AlertRule.find().sort({ createdAt: -1 }).populate('recipients', 'name email phone').lean();
    const admins = await User.find({ capabilities: UserCapability.ADMIN, isBlocked: { $ne: true } }).select('name email phone').lean();
    return { rules, admins, ...this.metrics() };
  }

  async create(input: RuleInput, adminId: string) {
    if ((await AlertRule.countDocuments()) >= MAX_RULES) throw new AppError(`At most ${MAX_RULES} alert rules`, 422, 'VALIDATION_ERROR');
    const fields = await this.validate(input, false);
    const rule = await AlertRule.create({ ...fields, createdBy: new Types.ObjectId(adminId) });
    await audit(adminId, 'alert_rule.create', 'settings', rule._id.toString(), undefined, { name: rule.name, metric: rule.metric });
    return { rule };
  }

  async update(id: string, input: RuleInput, adminId: string) {
    const rule = await this.find(id);
    rule.set(await this.validate(input, true));
    await rule.save();
    await audit(adminId, 'alert_rule.update', 'settings', id, undefined, { name: rule.name });
    return { rule };
  }

  async remove(id: string, adminId: string) {
    const rule = await this.find(id);
    await rule.deleteOne();
    await audit(adminId, 'alert_rule.delete', 'settings', id, undefined, { name: rule.name });
    return { deleted: true };
  }

  /** Sends a test alert to the rule's recipients now */
  async test(id: string, adminId: string) {
    const rule = await this.find(id);
    const value = await METRICS[rule.metric].read({ now: new Date(), since: new Date(Date.now() - 60_000) });
    const sent = await this.notify(rule, value, true);
    await audit(adminId, 'alert_rule.test', 'settings', id, undefined, { sent });
    return { value, sent };
  }

  /** Rules firing now, for the dashboard */
  async firing() {
    return AlertRule.find({ active: true, lastFiredAt: { $exists: true } })
      .select('name metric comparator threshold lastValue lastFiredAt lastCheckedAt cooldownMins')
      .lean()
      .then((rules) => rules.filter((r) => r.lastValue !== undefined && fires(r, r.lastValue)));
  }

  /** Checks every active rule once; returns how many fired */
  async check(now = new Date()): Promise<number> {
    const rules = await AlertRule.find({ active: true });
    let fired = 0;
    for (const rule of rules) {
      const measure = METRICS[rule.metric];
      if (!measure) continue;
      try {
        const since = rule.lastCheckedAt ?? new Date(now.getTime() - 60_000);
        const value = await measure.read({ now, since });
        const quiet = rule.lastFiredAt && now.getTime() - rule.lastFiredAt.getTime() < rule.cooldownMins * 60_000;
        // "New" measures page for each new item even inside the cooldown
        const fire = fires(rule, value) && (!quiet || rule.metric === 'new_sos');
        const set: Record<string, unknown> = { lastValue: value, lastCheckedAt: now };
        if (fire) {
          const sent = await this.notify(rule, value, false);
          set.lastFiredAt = now;
          await AlertRule.updateOne({ _id: rule._id }, { $set: set, $push: { history: { $each: [{ at: now, value, sent }], $position: 0, $slice: 20 } } });
          fired++;
        } else {
          await AlertRule.updateOne({ _id: rule._id }, { $set: set });
        }
      } catch (error) {
        logger.error('Alert rule check failed', { ruleId: rule._id.toString(), error: (error as Error).message });
      }
    }
    return fired;
  }

  private async notify(rule: IAlertRule, value: number, test: boolean) {
    const measure = METRICS[rule.metric];
    const shown = measure.unit === 'percent' ? `${value}%` : String(value);
    const limit = measure.unit === 'percent' ? `${rule.threshold}%` : String(rule.threshold);
    const title = `${test ? '[Test] ' : ''}Siham alert: ${rule.name}`;
    const line = `${measure.label} is ${shown}, ${rule.comparator} the limit of ${limit}.`;
    const link = config.admin.webUrl ? `${config.admin.webUrl}/` : '';
    const recipients = await User.find({ _id: { $in: rule.recipients }, capabilities: UserCapability.ADMIN }).select('email phone name').lean();
    const sent = { email: 0, sms: 0 };
    for (const r of recipients) {
      if (rule.channels.email && r.email) {
        const ok = await sendMail({
          to: r.email,
          subject: title,
          text: `${line}\n${link ? `\nOpen the admin: ${link}\n` : ''}\nYou get this because you are on the "${rule.name}" alert rule.`,
          html: emailLayout(rule.name, `<p style="font-size:16px">${escapeHtml(line)}</p>${link ? `<p><a href="${escapeHtml(link)}">Open the admin</a></p>` : ''}<p style="font-size:12px;color:#75746f">You get this because you are on this alert rule.</p>`),
        });
        if (ok) sent.email++;
      }
      if (rule.channels.sms && r.phone && !r.phone.startsWith('firebase:')) {
        try {
          await this.notifications.sendSMS(r.phone, `${title}. ${line}`.slice(0, 300));
          if (config.twilio.enabled) sent.sms++;
        } catch {
          // Logged by sendSMS; the other channels still go out
        }
      }
    }
    return sent;
  }

  private async validate(input: RuleInput, partial: boolean) {
    const out: Record<string, unknown> = {};
    const fail = (m: string): never => { throw new AppError(m, 422, 'VALIDATION_ERROR'); };
    if (input.name !== undefined || !partial) {
      const name = String(input.name ?? '').trim();
      if (!name || name.length > 80) fail('Name the rule in up to 80 characters');
      out.name = name;
    }
    if (input.metric !== undefined || !partial) {
      if (!METRICS[String(input.metric)]) fail('Choose what to watch');
      out.metric = String(input.metric);
    }
    if (input.comparator !== undefined || !partial) {
      if (input.comparator !== 'above' && input.comparator !== 'below') fail('Choose above or below');
      out.comparator = input.comparator;
    }
    if (input.threshold !== undefined || !partial) {
      const n = Number(input.threshold);
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000) fail('The threshold must be a number from 0');
      out.threshold = n;
    }
    if (input.channels !== undefined) out.channels = { email: Boolean(input.channels.email), sms: Boolean(input.channels.sms) };
    if (input.recipients !== undefined || !partial) {
      const ids = Array.isArray(input.recipients) ? [...new Set(input.recipients.map(String))] : [];
      if (!ids.length || ids.some((i) => !Types.ObjectId.isValid(i))) fail('Choose at least one admin to tell');
      const admins = await User.countDocuments({ _id: { $in: ids }, capabilities: UserCapability.ADMIN });
      if (admins !== ids.length) fail('Alerts can only go to admins');
      out.recipients = ids.map((i) => new Types.ObjectId(i));
    }
    if (input.cooldownMins !== undefined) {
      const n = Number(input.cooldownMins);
      if (!Number.isInteger(n) || n < 5 || n > 1440) fail('The quiet period is 5 minutes to 24 hours');
      out.cooldownMins = n;
    }
    if (input.active !== undefined) out.active = Boolean(input.active);
    return out;
  }

  private async find(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Alert rule');
    const rule = await AlertRule.findById(id);
    if (!rule) throw new NotFoundError('Alert rule');
    return rule;
  }
}
