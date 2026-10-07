/**
 * InvoiceService.ts
 *
 * Monthly company bills (UC-C03; decided 2 October 2026: invoice by email
 * on the 1st, bank transfer within 30 days). Each bill covers the company's
 * share of its staff's trips completed and not yet billed, so a trip that
 * completes after its month was billed goes on the next bill. A bill more
 * than 30 days unpaid puts the company on a billing hold: its contribution
 * to fares pauses until an admin records the payment.
 */

import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Types } from 'mongoose';
import { REGION, money, toLocalClock } from '../config/region';
import { Booking } from '../models/Booking';
import { CompanyInvoice, ICompanyInvoice } from '../models/CompanyInvoice';
import { Organisation, IOrganisation } from '../models/Organisation';
import { BookingStatus } from '../types';
import { AppError, ConflictError, NotFoundError } from '../utils/AppError';
import { round2 } from '../utils/fares';
import { logger } from '../utils/logger';
import { audit } from './AuditService';
import { emailLayout, escapeHtml, mailEnabled, sendMail } from './Mailer';

const DAY = 86_400_000;
/** What a bill's documents need about the company */
type BillTo = Pick<IOrganisation, 'name' | 'billingContact'>;
export const PAYMENT_TERMS_DAYS = 30;
/** Bills go out from 06:00 on the 1st, once last month's evening trips have finished */
const BILLING_HOUR = 6;

const prevMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
};
const monthName = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};
const day = (d: Date) => toLocalClock(d).toISOString().slice(0, 10);
const isDuplicate = (e: unknown) => (e as { code?: number })?.code === 11000;

/** Completed company-paid trips not on any bill yet, up to the end of a month */
const billable = (organisation: Types.ObjectId | undefined, month: string) => ({
  status: BookingStatus.COMPLETED,
  ...(organisation ? { organisation } : { organisation: { $exists: true } }),
  companyShare: { $gt: 0 },
  companyMonth: { $lte: month },
  companyInvoice: { $exists: false },
});

export function invoiceView(i: ICompanyInvoice | (Record<string, unknown> & { _id: Types.ObjectId }), withLines = false) {
  const v = i as ICompanyInvoice;
  return {
    _id: v._id.toString(),
    organisation: v.organisation.toString(),
    month: v.month,
    number: v.number,
    trips: v.trips,
    members: v.members,
    amount: v.amount,
    adjustments: v.adjustments,
    total: v.total,
    co2SavedKg: v.co2SavedKg,
    status: v.status,
    overdue: v.status === 'issued' && v.dueAt.getTime() < Date.now(),
    issuedAt: v.issuedAt,
    dueAt: v.dueAt,
    emailedAt: v.emailedAt,
    emailError: v.emailError,
    paidAt: v.paidAt,
    paidReference: v.paidReference,
    ...(withLines ? { lines: v.lines } : {}),
  };
}

export class InvoiceService {
  // ── Issuing ──────────────────────────────────────────────────────────────

  /**
   * The month due for billing now: last month, from 06:00 on the 1st. Before
   * that on the 1st, the month before, which was billed already.
   */
  billingMonth(now = new Date()): string {
    const local = toLocalClock(now);
    const thisMonth = local.toISOString().slice(0, 7);
    const early = local.getUTCDate() === 1 && local.getUTCHours() < BILLING_HOUR;
    return early ? prevMonth(prevMonth(thisMonth)) : prevMonth(thisMonth);
  }

  /** Bills every company with unbilled trips up to the end of the month. Safe to run again. */
  async billMonth(month: string, now = new Date()): Promise<ICompanyInvoice[]> {
    await this.releaseOrphans();
    const orgs: Types.ObjectId[] = await Booking.distinct('organisation', billable(undefined, month));
    const issued: ICompanyInvoice[] = [];
    for (const org of orgs) {
      const invoice = await this.issue(org, month, now).catch((error: Error) => {
        logger.error('Could not issue a company bill', { organisation: String(org), month, error: error.message });
        return null;
      });
      if (invoice) issued.push(invoice);
    }
    return issued;
  }

  /**
   * One company's bill for a month. Bookings are reserved for it first, so
   * nothing is billed twice; if the bill exists already (another instance
   * was first), the reservation is released and that bill returned.
   */
  async issue(organisation: Types.ObjectId | string, month: string, now = new Date()): Promise<ICompanyInvoice | null> {
    const orgId = new Types.ObjectId(String(organisation));
    const existing = await CompanyInvoice.findOne({ organisation: orgId, month });
    if (existing) return existing;

    const invoiceId = new Types.ObjectId();
    await Booking.updateMany(billable(orgId, month), { $set: { companyInvoice: invoiceId } });
    const bookings = await Booking.find({ companyInvoice: invoiceId })
      .select('rider estimatedFare companyShare co2SavedKg actualDropoffTime updatedAt')
      .populate<{ rider: { _id: Types.ObjectId; name?: string } | null }>('rider', 'name')
      .sort({ actualDropoffTime: 1 })
      .lean();
    // Nothing left to reserve: another run may have just billed them
    if (!bookings.length) return CompanyInvoice.findOne({ organisation: orgId, month });

    const lines = bookings.map((b) => ({
      booking: b._id,
      date: b.actualDropoffTime ?? b.updatedAt,
      member: b.rider?.name ?? 'Former member',
      fare: round2(b.estimatedFare),
      companyShare: round2(b.companyShare ?? 0),
      co2SavedKg: round2(b.co2SavedKg ?? 0),
    }));
    const amount = round2(lines.reduce((s, l) => s + l.companyShare, 0));
    try {
      return await CompanyInvoice.create({
        _id: invoiceId,
        organisation: orgId,
        month,
        number: `PL-${month.replace('-', '')}-${orgId.toString().slice(-6).toUpperCase()}`,
        lines,
        trips: lines.length,
        members: new Set(bookings.map((b) => String(b.rider?._id ?? ''))).size,
        amount,
        adjustments: [],
        total: amount,
        co2SavedKg: round2(lines.reduce((s, l) => s + l.co2SavedKg, 0)),
        status: 'issued',
        issuedAt: now,
        dueAt: new Date(now.getTime() + PAYMENT_TERMS_DAYS * DAY),
      });
    } catch (error) {
      await Booking.updateMany({ companyInvoice: invoiceId }, { $unset: { companyInvoice: 1 } });
      if (isDuplicate(error)) return CompanyInvoice.findOne({ organisation: orgId, month });
      throw error;
    }
  }

  /** Bookings reserved for a bill that was never written (a crash in between) go back to be billed */
  private async releaseOrphans() {
    const reserved: Types.ObjectId[] = await Booking.distinct('companyInvoice', { companyInvoice: { $exists: true }, updatedAt: { $lt: new Date(Date.now() - 3_600_000) } });
    if (!reserved.length) return;
    const real = new Set((await CompanyInvoice.find({ _id: { $in: reserved } }).select('_id').lean()).map((i) => String(i._id)));
    const orphans = reserved.filter((id) => !real.has(String(id)));
    if (orphans.length) {
      await Booking.updateMany({ companyInvoice: { $in: orphans } }, { $unset: { companyInvoice: 1 } });
      logger.warn('Released bookings reserved for company bills that were never written', { count: orphans.length });
    }
  }

  // ── Email ────────────────────────────────────────────────────────────────

  /** Emails each bill not yet sent to its company's billing contact; claimed first, so once */
  async emailDue(): Promise<number> {
    if (!mailEnabled()) return 0;
    let sent = 0;
    const waiting = await CompanyInvoice.find({ emailedAt: { $exists: false } }).select('_id').lean();
    for (const { _id } of waiting) {
      const invoice = await CompanyInvoice.findOneAndUpdate({ _id, emailedAt: { $exists: false } }, { $set: { emailedAt: new Date() }, $unset: { emailError: 1 } }, { new: true });
      if (!invoice) continue;
      const org = await Organisation.findById(invoice.organisation).lean();
      if (!org) continue;
      const ok = await this.email(invoice, org).catch((error: Error) => {
        logger.error('Company bill email failed', { invoice: invoice.number, error: error.message });
        return false;
      });
      if (ok) sent++;
      // Not sent: tried again on the next run
      else await CompanyInvoice.updateOne({ _id }, { $unset: { emailedAt: 1 }, $set: { emailError: 'The email could not be sent' } });
    }
    return sent;
  }

  async email(invoice: ICompanyInvoice, o: BillTo): Promise<boolean> {
    const subject = `Siham bill ${invoice.number}: ${monthName(invoice.month)}, ${money(invoice.total)}`;
    const due = day(invoice.dueAt);
    const text = [
      `Hello ${o.billingContact.name},`,
      `Here is ${o.name}'s Siham bill for ${monthName(invoice.month)}: your share of ${invoice.trips} trip${invoice.trips === 1 ? '' : 's'} by ${invoice.members} member${invoice.members === 1 ? '' : 's'} of staff, ${money(invoice.total)}.`,
      `Please pay by bank transfer by ${due}, quoting ${invoice.number}. Sharing these rides saved about ${invoice.co2SavedKg} kg of CO2.`,
      'The statement is attached as a PDF and a spreadsheet. Reply to this email with any questions.',
    ].join('\n\n');
    const [pdf, xlsx] = await Promise.all([this.pdf(invoice, o), this.xlsx(invoice, o)]);
    return sendMail({
      to: o.billingContact.email,
      subject,
      text,
      html: emailLayout(subject, text.split('\n\n').map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')),
      attachments: [
        { filename: `${invoice.number}.pdf`, content: pdf, contentType: 'application/pdf' },
        { filename: `${invoice.number}.xlsx`, content: xlsx, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      ],
    });
  }

  // ── Late payment (UC-C03 3a) ─────────────────────────────────────────────

  /** Companies with a bill more than 30 days unpaid go on hold: their contribution pauses */
  async enforceHolds(now = new Date()): Promise<number> {
    const overdue = await CompanyInvoice.find({ status: 'issued', dueAt: { $lt: now } }).select('organisation number').sort({ dueAt: 1 }).lean();
    let held = 0;
    for (const inv of overdue) {
      const done = await Organisation.updateOne(
        { _id: inv.organisation, billingHold: { $exists: false } },
        { $set: { billingHold: { invoice: inv._id, since: now } } },
      );
      if (done.modifiedCount) {
        held++;
        logger.warn('Company contribution paused: bill overdue', { organisation: String(inv.organisation), invoice: inv.number });
        const { pushAdmins } = await import('./SafetyAlerts');
        await pushAdmins('Company bill overdue', `Bill ${inv.number} is more than ${PAYMENT_TERMS_DAYS} days unpaid. The company's contribution to fares is paused until it is paid.`, { type: 'invoice', invoiceId: String(inv._id) }).catch(() => undefined);
      }
    }
    return held;
  }

  // ── Admin ────────────────────────────────────────────────────────────────

  async list(organisation: string) {
    const invoices = await CompanyInvoice.find({ organisation }).select('-lines').sort({ month: -1 }).lean();
    return { invoices: invoices.map((i) => invoiceView(i)) };
  }

  async get(id: string) {
    const invoice = await this.find(id);
    return { invoice: invoiceView(invoice, true) };
  }

  /** The company's bank transfer arrived; lifts the hold once nothing else is overdue */
  async markPaid(id: string, adminId: string, reference: unknown) {
    const ref = String(reference ?? '').trim();
    if (ref.length < 3) throw new AppError('Give the bank transfer\'s reference', 422, 'VALIDATION_ERROR');
    const invoice = await CompanyInvoice.findOneAndUpdate(
      { _id: id, status: 'issued' },
      { $set: { status: 'paid', paidAt: new Date(), paidReference: ref.slice(0, 100), recordedBy: new Types.ObjectId(adminId) } },
      { new: true },
    );
    if (!invoice) {
      await this.find(id);
      throw new ConflictError('This bill is already paid');
    }
    const stillOverdue = await CompanyInvoice.exists({ organisation: invoice.organisation, status: 'issued', dueAt: { $lt: new Date() } });
    if (!stillOverdue) await Organisation.updateOne({ _id: invoice.organisation }, { $unset: { billingHold: 1 } });
    await audit(adminId, 'invoice.paid', 'invoice', id, undefined, { number: invoice.number, total: invoice.total, reference: ref });
    return { invoice: invoiceView(invoice) };
  }

  /** A credit (negative) or charge on an unpaid bill, with the reason, e.g. after a dispute */
  async adjust(id: string, adminId: string, amountInput: unknown, reasonInput: unknown) {
    const amount = round2(Number(amountInput));
    const reason = String(reasonInput ?? '').trim();
    if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 100_000) throw new AppError('Give the amount to add or, as a negative number, to take off', 422, 'VALIDATION_ERROR');
    if (reason.length < 5) throw new AppError('Say why, for the company and the audit log', 422, 'VALIDATION_ERROR');
    const invoice = await this.find(id);
    if (invoice.status !== 'issued') throw new ConflictError('A paid bill cannot be changed');
    const total = round2(invoice.total + amount);
    if (total < 0) throw new AppError('The bill cannot go below zero', 422, 'VALIDATION_ERROR');
    invoice.adjustments.push({ amount, reason: reason.slice(0, 300), by: new Types.ObjectId(adminId), at: new Date() });
    invoice.total = total;
    await invoice.save();
    await audit(adminId, 'invoice.adjust', 'invoice', id, reason, { number: invoice.number, amount, total });
    return { invoice: invoiceView(invoice) };
  }

  /** Bills last month now, for one company, instead of waiting for the job */
  async billNow(organisation: string, adminId: string) {
    const org = await Organisation.findById(organisation).lean();
    if (!org) throw new NotFoundError('Company');
    const month = this.billingMonth();
    const invoice = await this.issue(org._id, month);
    if (!invoice) throw new AppError(`Nothing to bill for ${monthName(month)}`, 409, 'NOTHING_TO_BILL');
    await audit(adminId, 'invoice.issue', 'invoice', String(invoice._id), undefined, { number: invoice.number, month });
    await this.emailDue();
    return { invoice: invoiceView(await this.find(String(invoice._id))) };
  }

  async file(id: string, format: 'pdf' | 'xlsx') {
    const invoice = await this.find(id);
    const org = await Organisation.findById(invoice.organisation).lean();
    if (!org) throw new NotFoundError('Company');
    const body = format === 'pdf' ? await this.pdf(invoice, org) : await this.xlsx(invoice, org);
    return {
      body,
      filename: `${invoice.number}.${format}`,
      contentType: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private async find(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Bill');
    const invoice = await CompanyInvoice.findById(id);
    if (!invoice) throw new NotFoundError('Bill');
    return invoice;
  }

  // ── Documents ────────────────────────────────────────────────────────────

  async xlsx(invoice: ICompanyInvoice, org: BillTo): Promise<Buffer> {
    const book = new ExcelJS.Workbook();
    book.creator = 'Siham';
    const summary = book.addWorksheet('Bill');
    summary.addRow([`Siham bill ${invoice.number}`]).font = { bold: true, size: 14 };
    summary.addRow([org.name, monthName(invoice.month)]);
    summary.addRow([]);
    const rows: Array<[string, string | number]> = [
      ['Trips', invoice.trips],
      ['Members of staff', invoice.members],
      ['Company share of fares', invoice.amount],
      ...invoice.adjustments.map((a) => [`Adjustment: ${a.reason}`, a.amount] as [string, number]),
      ['Total due', invoice.total],
      ['Due by', day(invoice.dueAt)],
      ['CO2 saved, kg (estimate)', invoice.co2SavedKg],
    ];
    for (const [label, value] of rows) {
      const row = summary.addRow([label, value]);
      if (typeof value === 'number' && !['Trips', 'Members of staff', 'CO2 saved, kg (estimate)'].includes(label)) row.getCell(2).numFmt = '"US$"#,##0.00';
    }
    summary.getColumn(1).width = 40;
    summary.getColumn(2).width = 18;

    const trips = book.addWorksheet('Trips');
    trips.addRow(['Date', 'Member', 'Fare (US$)', 'Company share (US$)', 'CO2 saved (kg)']).font = { bold: true };
    for (const l of invoice.lines) trips.addRow([day(l.date), l.member, l.fare, l.companyShare, l.co2SavedKg]);
    [12, 28, 12, 20, 16].forEach((w, i) => { trips.getColumn(i + 1).width = w; });
    trips.views = [{ state: 'frozen', ySplit: 1 }];
    return Buffer.from(await book.xlsx.writeBuffer());
  }

  pdf(invoice: ICompanyInvoice, org: BillTo): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Siham bill ${invoice.number}`, Author: 'Siham' } });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      const left = doc.page.margins.left;
      const width = doc.page.width - left - doc.page.margins.right;

      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0b7a75').text('Siham');
      doc.font('Helvetica-Bold').fontSize(18).fillColor('#1a1a1a').text(`Bill ${invoice.number}`);
      doc.font('Helvetica').fontSize(10).fillColor('#555555')
        .text(`${org.name}, ${monthName(invoice.month)}. Issued ${day(invoice.issuedAt)}, due by ${day(invoice.dueAt)}. ${REGION.countryName} time.`);
      doc.text(`Billing contact: ${org.billingContact.name}, ${org.billingContact.email}`);
      doc.fillColor('#1a1a1a').moveDown(1);

      const pair = (label: string, value: string, bold = false) => {
        const y = doc.y;
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(11).text(label, left, y, { width: width * 0.7 });
        doc.text(value, left + width * 0.7, y, { width: width * 0.3, align: 'right' });
        doc.moveDown(0.3);
      };
      pair(`Company share of ${invoice.trips} trip${invoice.trips === 1 ? '' : 's'} by ${invoice.members} member${invoice.members === 1 ? '' : 's'} of staff`, money(invoice.amount));
      for (const a of invoice.adjustments) pair(`Adjustment: ${a.reason}`, `${a.amount < 0 ? '-' : ''}${money(Math.abs(a.amount))}`);
      pair('Total due', money(invoice.total), true);
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(10).fillColor('#555555')
        .text(`Pay by bank transfer within ${PAYMENT_TERMS_DAYS} days, quoting ${invoice.number}. Sharing these rides saved about ${invoice.co2SavedKg} kg of CO2 (an estimate).`);
      doc.fillColor('#1a1a1a').moveDown(1);

      const cols = [['Date', 0.16], ['Member', 0.4], ['Fare', 0.14], ['Company share', 0.18], ['CO2 kg', 0.12]] as const;
      const row = (cells: string[], bold: boolean) => {
        if (doc.y + 16 > doc.page.height - doc.page.margins.bottom) doc.addPage();
        const y = doc.y;
        let x = left;
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
        cells.forEach((c, i) => {
          const w = width * cols[i][1];
          doc.text(c, x, y, { width: w - 6, align: i >= 2 ? 'right' : 'left' });
          x += w;
        });
        doc.y = y + 14;
        doc.x = left;
      };
      row(cols.map((c) => c[0]), true);
      for (const l of invoice.lines) row([day(l.date), l.member, money(l.fare), money(l.companyShare), String(l.co2SavedKg)], false);
      doc.end();
    });
  }
}
