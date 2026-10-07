/**
 * Scheduled report emails and Excel/PDF export against a real MongoDB:
 * send times and periods in India time, validation, one send per due run
 * even when two instances race, and failures recorded on the schedule.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import ExcelJS from 'exceljs';

const sendMail = jest.fn().mockResolvedValue(true);
const mailEnabled = jest.fn().mockReturnValue(true);
jest.mock('../../services/Mailer', () => ({
  ...jest.requireActual('../../services/Mailer'),
  sendMail: (...args: unknown[]) => sendMail(...args),
  mailEnabled: () => mailEnabled(),
}));

import { ReportSchedule } from '../../models/ReportSchedule';
import { AdminAuditLog } from '../../models/AdminAuditLog';
import { ReportScheduleService, nextRunAfter, periodFor } from '../../services/ReportScheduleService';
import { ReportService, parseReportParams } from '../../services/ReportService';
import { toPdf, toXlsx } from '../../services/ReportExport';

jest.setTimeout(60_000);

let mongo: MongoMemoryServer;
const service = new ReportScheduleService();
const admin = new Types.ObjectId().toString();
/** An India-time wall clock, as a UTC instant */
const ist = (s: string) => new Date(`${s}+02:00`);

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

beforeEach(async () => {
  await mongoose.connection.db!.dropDatabase();
  sendMail.mockClear().mockResolvedValue(true);
  mailEnabled.mockReturnValue(true);
});

describe('send times and periods', () => {
  it('sends daily at 07:00 India time', () => {
    expect(nextRunAfter('daily', ist('2026-09-24T06:59:00'))).toEqual(ist('2026-09-24T07:00:00'));
    expect(nextRunAfter('daily', ist('2026-09-24T07:00:00'))).toEqual(ist('2026-09-25T07:00:00'));
  });

  it('sends weekly on Monday and monthly on the 1st', () => {
    // 24 September 2026 is a Thursday
    expect(nextRunAfter('weekly', ist('2026-09-24T10:00:00'))).toEqual(ist('2026-09-28T07:00:00'));
    expect(nextRunAfter('weekly', ist('2026-09-28T06:00:00'))).toEqual(ist('2026-09-28T07:00:00'));
    expect(nextRunAfter('monthly', ist('2026-09-24T10:00:00'))).toEqual(ist('2026-10-01T07:00:00'));
    expect(nextRunAfter('monthly', ist('2026-12-01T08:00:00'))).toEqual(ist('2027-01-01T07:00:00'));
  });

  it('covers the day, week or month just ended', () => {
    const day = periodFor('daily', ist('2026-09-24T07:00:00'));
    expect(day.from).toEqual(ist('2026-09-23T00:00:00'));
    expect(day.to).toEqual(new Date(ist('2026-09-24T00:00:00').getTime() - 1));

    const week = periodFor('weekly', ist('2026-09-28T07:00:00'));
    expect(week.from).toEqual(ist('2026-09-21T00:00:00'));

    const month = periodFor('monthly', ist('2026-10-01T07:00:00'));
    expect(month).toMatchObject({ from: ist('2026-09-01T00:00:00'), groupBy: 'week' });
    expect(month.to).toEqual(new Date(ist('2026-10-01T00:00:00').getTime() - 1));
  });
});

describe('managing schedules', () => {
  it('creates a schedule with a tidy recipient list and audits it', async () => {
    const { schedule } = await service.create(
      { name: 'Weekly money', types: ['financial', 'rides'], frequency: 'weekly', recipients: 'Ops@Siham.app, ops@siham.app; cfo@siham.app' },
      admin,
    );
    expect(schedule).toMatchObject({ recipients: ['ops@siham.app', 'cfo@siham.app'], format: 'xlsx', active: true });
    expect(new Date(schedule.nextRunAt).getUTCDay()).toBe(1); // 07:00 CAT Monday is still Monday in UTC
    expect(await AdminAuditLog.countDocuments({ action: 'report_schedule.create' })).toBe(1);
  });

  it('refuses bad input', async () => {
    const base = { name: 'x', types: ['rides'], frequency: 'daily', recipients: ['a@b.co'] };
    await expect(service.create({ ...base, types: ['nope'] }, admin)).rejects.toThrow('Choose at least one report');
    await expect(service.create({ ...base, frequency: 'hourly' }, admin)).rejects.toThrow('daily, weekly or monthly');
    await expect(service.create({ ...base, recipients: ['not-an-email'] }, admin)).rejects.toThrow('not an email address');
    await expect(service.create({ ...base, format: 'docx' }, admin)).rejects.toThrow('CSV, Excel or PDF');
  });

  it('restarts the schedule when the frequency changes or it is switched back on', async () => {
    const { schedule } = await service.create({ name: 'Daily', types: ['rides'], frequency: 'daily', recipients: ['a@b.co'] }, admin);
    await ReportSchedule.updateOne({ _id: schedule.id }, { nextRunAt: new Date(0), active: false });
    const { schedule: updated } = await service.update(schedule.id, { active: true }, admin);
    expect(new Date(updated.nextRunAt).getTime()).toBeGreaterThan(Date.now());
    const { schedule: monthly } = await service.update(schedule.id, { frequency: 'monthly' }, admin);
    expect(new Date(monthly.nextRunAt).getUTCDate()).toBe(1);
  });
});

describe('sending', () => {
  const due = async (overrides: Record<string, unknown> = {}) =>
    ReportSchedule.create({
      name: 'Ops daily',
      types: ['rides', 'safety'],
      frequency: 'daily',
      format: 'csv',
      recipients: ['ops@siham.app', 'cfo@siham.app'],
      createdBy: admin,
      nextRunAt: new Date(Date.now() - 60_000),
      ...overrides,
    });

  it('emails each recipient once with one attachment per report, even when two runs race', async () => {
    const schedule = await due();
    const [a, b] = await Promise.all([service.runDue(), new ReportScheduleService().runDue()]);
    expect(a + b).toBe(1);
    expect(sendMail).toHaveBeenCalledTimes(2);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.subject).toContain('Daily Siham reports: Ops daily');
    expect(mail.attachments.map((x: { filename: string }) => x.filename)).toEqual([
      expect.stringMatching(/^siham-rides-.*\.csv$/),
      expect.stringMatching(/^siham-safety-.*\.csv$/),
    ]);
    expect(mail.text).toContain('Rides report');

    const after = await ReportSchedule.findById(schedule._id).lean();
    expect(after?.lastSentAt).toBeDefined();
    expect(after!.nextRunAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('records the failure when email is not set up, and does not retry the missed run', async () => {
    mailEnabled.mockReturnValue(false);
    const schedule = await due();
    expect(await service.runDue()).toBe(0);
    const after = await ReportSchedule.findById(schedule._id).lean();
    expect(after?.lastError).toContain('SMTP_HOST');
    expect(after!.nextRunAt.getTime()).toBeGreaterThan(Date.now());
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('skips paused schedules', async () => {
    await due({ active: false });
    expect(await service.runDue()).toBe(0);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('sends on demand without moving the schedule', async () => {
    const schedule = await due({ nextRunAt: new Date(Date.now() + 86_400_000), format: 'pdf' });
    expect(await service.sendNow(schedule._id.toString(), admin)).toEqual({ sent: 2 });
    expect(sendMail.mock.calls[0][0].attachments[0].contentType).toBe('application/pdf');
    const after = await ReportSchedule.findById(schedule._id).lean();
    expect(after!.nextRunAt).toEqual(schedule.nextRunAt);
  });
});

describe('Excel and PDF export', () => {
  it('writes a workbook with summary, per-period and table sheets', async () => {
    const report = await new ReportService().build('rides', parseReportParams({ groupBy: 'week' }));
    const book = new ExcelJS.Workbook();
    await book.xlsx.load((await toXlsx(report)) as unknown as ArrayBuffer);
    const names = book.worksheets.map((w) => w.name);
    expect(names.slice(0, 2)).toEqual(['Summary', 'By week']);
    expect(names.length).toBe(2 + report.tables.length);
    expect(book.getWorksheet('Summary')!.getCell('A1').value).toBe('Siham rides report');
  });

  it('writes a PDF', async () => {
    const report = await new ReportService().build('financial', parseReportParams({}));
    const pdf = await toPdf(report);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
