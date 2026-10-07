/**
 * ReportScheduleService.ts
 *
 * Reports emailed on a schedule (UC-A06). An admin picks reports, a
 * frequency, a file format and up to ten recipients. Each run covers the
 * period that has just ended, in Zimbabwe time:
 * - daily: yesterday, sent every day at 07:00
 * - weekly: the seven days before Monday, sent on Monday at 07:00
 * - monthly: last calendar month, sent on the 1st at 07:00
 * jobs/ReportScheduler.ts sends the ones that are due. Email goes out over
 * SMTP (services/Mailer.ts); without it runs are recorded as failed.
 */

import { Types } from 'mongoose';
import { ReportSchedule, IReportSchedule } from '../models/ReportSchedule';
import { ReportService, REPORT_TYPES, ReportType, ReportParams, GroupBy, Report } from './ReportService';
import { CONTENT_TYPES, EXPORT_FORMATS, ExportFormat, formatFigure, localDay, reportFilename, reportTitle, toPdf, toXlsx } from './ReportExport';
import { sendMail, mailEnabled, emailLayout, escapeHtml } from './Mailer';
import { audit } from './AuditService';
import { AppError, NotFoundError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { fromLocalClock, localTime, toLocalClock } from '../config/region';

export const FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

const DAY = 86_400_000;
const SEND_HOUR = 7; // 07:00 Zimbabwe time
const MAX_RECIPIENTS = 10;
const MAX_SCHEDULES = 50;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GROUP_BY: Record<Frequency, GroupBy> = { daily: 'day', weekly: 'day', monthly: 'week' };
const LABEL: Record<Frequency, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

/** Midnight Zimbabwe time at the start of the day containing `at`, as a UTC instant */
function localMidnight(at: Date): Date {
  const local = toLocalClock(at);
  local.setUTCHours(0, 0, 0, 0);
  return fromLocalClock(local);
}

/** The first send time strictly after `after` */
export function nextRunAfter(frequency: Frequency, after: Date): Date {
  // Work on Zimbabwe wall-clock values held in UTC fields, then shift back
  const local = toLocalClock(after);
  const t = new Date(local);
  t.setUTCHours(SEND_HOUR, 0, 0, 0);
  if (frequency === 'monthly') {
    t.setUTCDate(1);
    if (t <= local) t.setUTCMonth(t.getUTCMonth() + 1);
  } else {
    if (t <= local) t.setUTCDate(t.getUTCDate() + 1);
    if (frequency === 'weekly') while (t.getUTCDay() !== 1) t.setUTCDate(t.getUTCDate() + 1);
  }
  return fromLocalClock(t);
}

/** The period a run at `runAt` reports on: the day, week or month just ended */
export function periodFor(frequency: Frequency, runAt: Date): ReportParams {
  const today = localMidnight(runAt);
  const to = new Date(today.getTime() - 1);
  let from: Date;
  if (frequency === 'daily') from = new Date(today.getTime() - DAY);
  else if (frequency === 'weekly') from = new Date(today.getTime() - 7 * DAY);
  else {
    const local = toLocalClock(today);
    local.setUTCDate(1);
    local.setUTCMonth(local.getUTCMonth() - 1);
    from = fromLocalClock(local);
  }
  return { from, to, groupBy: GROUP_BY[frequency] };
}

interface ScheduleInput {
  name?: unknown;
  types?: unknown;
  frequency?: unknown;
  format?: unknown;
  recipients?: unknown;
  active?: unknown;
}

function validate(input: ScheduleInput, partial: boolean) {
  const out: Partial<Pick<IReportSchedule, 'name' | 'types' | 'frequency' | 'format' | 'recipients' | 'active'>> = {};
  const fail = (message: string) => { throw new AppError(message, 422, 'VALIDATION_ERROR'); };

  if (input.name !== undefined || !partial) {
    const name = String(input.name ?? '').trim();
    if (!name || name.length > 80) fail('Give the schedule a name of up to 80 characters');
    out.name = name;
  }
  if (input.types !== undefined || !partial) {
    const types = Array.isArray(input.types) ? [...new Set(input.types.map(String))] : [];
    if (!types.length || types.some((t) => !REPORT_TYPES.includes(t as ReportType))) fail('Choose at least one report');
    out.types = types as ReportType[];
  }
  if (input.frequency !== undefined || !partial) {
    if (!FREQUENCIES.includes(input.frequency as Frequency)) fail('Choose daily, weekly or monthly');
    out.frequency = input.frequency as Frequency;
  }
  if (input.format !== undefined) {
    if (!EXPORT_FORMATS.includes(input.format as ExportFormat)) fail('Choose CSV, Excel or PDF');
    out.format = input.format as ExportFormat;
  }
  if (input.recipients !== undefined || !partial) {
    const list = Array.isArray(input.recipients)
      ? input.recipients
      : String(input.recipients ?? '').split(/[\s,;]+/);
    const recipients = [...new Set(list.map((r) => String(r).trim().toLowerCase()).filter(Boolean))];
    if (!recipients.length) fail('Add at least one email address');
    if (recipients.length > MAX_RECIPIENTS) fail(`Send to at most ${MAX_RECIPIENTS} addresses`);
    const bad = recipients.find((r) => !EMAIL.test(r));
    if (bad) fail(`"${bad}" is not an email address`);
    out.recipients = recipients;
  }
  if (input.active !== undefined) out.active = Boolean(input.active);
  return out;
}

const view = (s: IReportSchedule) => ({
  id: s._id.toString(),
  name: s.name,
  types: s.types,
  frequency: s.frequency,
  format: s.format,
  recipients: s.recipients,
  active: s.active,
  nextRunAt: s.nextRunAt,
  lastSentAt: s.lastSentAt ?? null,
  lastError: s.lastError ?? null,
  createdAt: s.createdAt,
});

export class ReportScheduleService {
  private reports = new ReportService();

  async list() {
    const schedules = await ReportSchedule.find().sort({ createdAt: -1 });
    return { schedules: schedules.map(view), emailEnabled: mailEnabled() };
  }

  async create(input: ScheduleInput, adminId: string) {
    if ((await ReportSchedule.countDocuments()) >= MAX_SCHEDULES) {
      throw new AppError(`There can be at most ${MAX_SCHEDULES} scheduled reports`, 422, 'VALIDATION_ERROR');
    }
    const fields = validate(input, false) as Required<ReturnType<typeof validate>>;
    const schedule = await ReportSchedule.create({
      ...fields,
      createdBy: new Types.ObjectId(adminId),
      nextRunAt: nextRunAfter(fields.frequency, new Date()),
    });
    await audit(adminId, 'report_schedule.create', 'report', schedule._id.toString(), undefined, {
      name: schedule.name, types: schedule.types, frequency: schedule.frequency, recipients: schedule.recipients,
    });
    return { schedule: view(schedule) };
  }

  async update(id: string, input: ScheduleInput, adminId: string) {
    const schedule = await this.find(id);
    const changes = validate(input, true);
    const before = { active: schedule.active, frequency: schedule.frequency };
    schedule.set(changes);
    // A new frequency, or switching back on, starts from the next send time
    if (schedule.frequency !== before.frequency || (!before.active && schedule.active)) {
      schedule.nextRunAt = nextRunAfter(schedule.frequency, new Date());
    }
    await schedule.save();
    await audit(adminId, 'report_schedule.update', 'report', id, undefined, changes as Record<string, unknown>);
    return { schedule: view(schedule) };
  }

  async remove(id: string, adminId: string) {
    const schedule = await this.find(id);
    await schedule.deleteOne();
    await audit(adminId, 'report_schedule.delete', 'report', id, undefined, { name: schedule.name });
    return { deleted: true };
  }

  /** Sends a schedule's reports now, for the period that has just ended. The regular schedule is unchanged. */
  async sendNow(id: string, adminId: string) {
    if (!mailEnabled()) throw new AppError('Email is not set up on the server (SMTP_HOST)', 503, 'EMAIL_UNAVAILABLE');
    const schedule = await this.find(id);
    const sent = await this.deliver(schedule, new Date());
    await audit(adminId, 'report_schedule.send_now', 'report', id, undefined, { sent });
    return { sent };
  }

  /**
   * Sends every schedule that is due. Each one is claimed by moving its
   * next send time forward first, so two backend instances never both send it.
   */
  async runDue(now = new Date()): Promise<number> {
    const due = await ReportSchedule.find({ active: true, nextRunAt: { $lte: now } }).limit(MAX_SCHEDULES);
    let sent = 0;
    for (const schedule of due) {
      const dueAt = schedule.nextRunAt;
      const claimed = await ReportSchedule.findOneAndUpdate(
        { _id: schedule._id, active: true, nextRunAt: dueAt },
        // After downtime, skip missed runs rather than sending a backlog
        { $set: { nextRunAt: nextRunAfter(schedule.frequency, now > dueAt ? now : dueAt) } },
        { new: true },
      );
      if (!claimed) continue;
      try {
        if (!mailEnabled()) throw new Error('Email is not set up on the server (SMTP_HOST)');
        const delivered = await this.deliver(claimed, dueAt);
        if (!delivered) throw new Error('No email could be sent to the recipients');
        await ReportSchedule.updateOne({ _id: claimed._id }, { $set: { lastSentAt: now }, $unset: { lastError: 1 } });
        sent++;
      } catch (error) {
        const message = (error as Error).message;
        logger.error('Scheduled report failed', { scheduleId: claimed._id.toString(), error: message });
        await ReportSchedule.updateOne({ _id: claimed._id }, { $set: { lastError: message } });
      }
    }
    return sent;
  }

  /** Builds the reports and emails them to each recipient. Returns how many emails went out. */
  async deliver(schedule: IReportSchedule, runAt: Date): Promise<number> {
    const params = periodFor(schedule.frequency, runAt);
    const reports: Report[] = [];
    for (const type of schedule.types) reports.push(await this.reports.build(type, params));
    const attachments = await Promise.all(reports.map((r) => this.attachment(r, schedule.format)));

    const range = `${localDay(params.from.toISOString())} to ${localDay(params.to.toISOString())}`;
    const localRange = `${fmtDay(params.from)} to ${fmtDay(params.to)}`;
    const subject = `${LABEL[schedule.frequency]} Siham reports: ${schedule.name} (${fmtDay(params.from)}${schedule.frequency === 'daily' ? '' : ` to ${fmtDay(params.to)}`})`;
    const text = [
      `${schedule.name}: ${localRange}, Zimbabwe time.`,
      '',
      ...reports.flatMap((r) => [
        reportTitle(r),
        ...r.summary.map((s) => `  ${s.label}: ${formatFigure(s.value, s.format)}`),
        '',
      ]),
      `The full reports are attached (${schedule.format.toUpperCase()}).`,
      'You get this email because an admin added you to a scheduled report in the Siham admin.',
    ].join('\n');
    const html = emailLayout(
      `${schedule.name}`,
      `<p style="color:#55544f;margin:0 0 16px">${escapeHtml(localRange)}, Zimbabwe time. The full reports are attached as ${schedule.format.toUpperCase()}.</p>` +
        reports.map((r) => `<h2 style="font-size:15px;margin:20px 0 8px">${escapeHtml(reportTitle(r))}</h2>
<table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px">
${r.summary.map((s) => `<tr><td style="border-bottom:1px solid #eeede8">${escapeHtml(s.label)}</td><td align="right" style="border-bottom:1px solid #eeede8;font-weight:bold">${escapeHtml(formatFigure(s.value, s.format))}</td></tr>`).join('\n')}
</table>`).join('\n') +
        '<p style="font-size:12px;color:#75746f;margin-top:20px">You get this email because an admin added you to a scheduled report in the Siham admin.</p>',
    );

    let delivered = 0;
    for (const to of schedule.recipients) {
      if (await sendMail({ to, subject, text, html, attachments })) delivered++;
    }
    logger.info('Scheduled report sent', { scheduleId: schedule._id.toString(), range, delivered });
    return delivered;
  }

  private async attachment(report: Report, format: ExportFormat) {
    const content = format === 'xlsx' ? await toXlsx(report)
      : format === 'pdf' ? await toPdf(report)
      : this.reports.toCsv(report);
    return { filename: reportFilename(report, format), content, contentType: CONTENT_TYPES[format] };
  }

  private async find(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Scheduled report');
    const schedule = await ReportSchedule.findById(id);
    if (!schedule) throw new NotFoundError('Scheduled report');
    return schedule;
  }
}

/** "24 Sep 2026" in Zimbabwe time */
function fmtDay(d: Date): string {
  return localTime(d, { day: 'numeric', month: 'short', year: 'numeric' });
}
