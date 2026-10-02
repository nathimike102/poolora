/**
 * CompanyPortalService.ts
 *
 * A company's own dashboard (UC-C01 step 3), for the people a Poolora admin
 * named as its company admins. They see who joined, how many trips the
 * company helped pay for, what it cost, the CO₂ saved and their bills.
 * Never where anyone went, positions, ratings or safety reports.
 */

import crypto from 'crypto';
import { Types } from 'mongoose';
import { config } from '../config';
import { toLocalClock } from '../config/region';
import { Booking } from '../models/Booking';
import { CompanyInvoice } from '../models/CompanyInvoice';
import { Organisation } from '../models/Organisation';
import { User } from '../models/User';
import { BookingStatus } from '../types';
import { AppError, AuthorizationError, ConflictError, NotFoundError } from '../utils/AppError';
import { round2 } from '../utils/fares';
import { logger } from '../utils/logger';
import { audit } from './AuditService';
import { InvoiceService, invoiceView } from './InvoiceService';
import { emailLayout, escapeHtml, mailEnabled, sendMail } from './Mailer';

const domainOf = (email: string) => email.split('@')[1] ?? '';

/** The company this person is an admin of, or a refusal */
export async function companyOfAdmin(userId: string) {
  const org = await Organisation.findOne({ 'admins.user': userId }).lean();
  if (!org) throw new AuthorizationError('This account is not a company admin');
  return org;
}

export class CompanyPortalService {
  private invoices = new InvoiceService();

  // ── Poolora admins name company admins ───────────────────────────────────

  /**
   * Makes someone at the company an admin of its dashboard. The address must
   * be on the company's domains or be its billing contact. Without an
   * account they get one, with a link to set a password.
   */
  async addAdmin(orgId: string, input: { name?: unknown; email?: unknown }, adminId: string) {
    const org = await Organisation.findById(orgId);
    if (!org) throw new NotFoundError('Company');
    const email = String(input.email ?? '').trim().toLowerCase();
    const name = String(input.name ?? '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('Give their email address', 422, 'VALIDATION_ERROR');
    if (!org.domains.includes(domainOf(email)) && email !== org.billingContact.email) {
      throw new AppError(`Use an address on ${org.domains.join(' or ')}, or the billing contact's`, 422, 'NOT_COMPANY_EMAIL');
    }
    if (org.admins.some((a) => a.email === email)) throw new ConflictError('They are already a company admin');

    let user = await User.findOne({ email });
    let link: string | null = null;
    if (!user) {
      if (name.length < 2) throw new AppError('Give their name', 422, 'VALIDATION_ERROR');
      const account = await this.firebaseAccount(email, name);
      user = await User.create({
        firebaseUid: account?.uid,
        phone: `company:${crypto.randomBytes(8).toString('hex')}`,
        email,
        name,
        capabilities: ['rider'],
      });
      link = account?.link ?? null;
    }
    if (user.capabilities.includes('admin' as never)) throw new ConflictError('Poolora admins already see every company');
    if (await Organisation.exists({ 'admins.user': user._id, _id: { $ne: org._id } })) {
      throw new ConflictError('They are an admin of another company');
    }
    org.admins.push({ user: user._id, email, addedBy: new Types.ObjectId(adminId), addedAt: new Date() });
    await org.save();
    await audit(adminId, 'organisation.addAdmin', 'organisation', orgId, undefined, { email });
    const told = await this.tellNewAdmin(email, user.name, org.name, link);
    return { added: { user: user._id.toString(), email, name: user.name }, emailed: told };
  }

  async removeAdmin(orgId: string, userId: string, adminId: string) {
    const done = await Organisation.updateOne({ _id: orgId }, { $pull: { admins: { user: new Types.ObjectId(userId) } } });
    if (!done.modifiedCount) throw new NotFoundError('Company admin');
    await audit(adminId, 'organisation.removeAdmin', 'organisation', orgId, undefined, { userId });
    return { removed: true };
  }

  /** A Firebase account for an email-only admin, and a link to set its password; null without Firebase */
  private async firebaseAccount(email: string, name: string): Promise<{ uid: string; link: string } | null> {
    try {
      const { getFirebaseAuth } = await import('../config/firebase');
      const auth = getFirebaseAuth();
      const existing = await auth.getUserByEmail(email).catch(() => null);
      const account = existing ?? (await auth.createUser({ email, displayName: name }));
      const continueUrl = config.admin.webUrl || undefined;
      const link = await auth.generatePasswordResetLink(email, continueUrl ? { url: continueUrl } : undefined);
      return { uid: account.uid, link };
    } catch (error) {
      logger.warn('Could not set up a sign-in for a company admin', { error: (error as Error).message });
      return null;
    }
  }

  private async tellNewAdmin(email: string, name: string, company: string, link: string | null): Promise<boolean> {
    if (!mailEnabled()) return false;
    const signIn = config.admin.webUrl || 'the Poolora dashboard';
    const lines = [
      `Hello ${name.split(' ')[0]},`,
      `You can now see ${company}'s Poolora programme: who has joined, the trips the company helps pay for, what they cost, and its bills.`,
      link ? `Set your password with this link, then sign in at ${signIn}: ${link}` : `Sign in at ${signIn} with this email address.`,
      'You will not see where anyone goes; that stays private to them.',
    ];
    const subject = `You can now see ${company}'s Poolora programme`;
    return sendMail({ to: email, subject, text: lines.join('\n\n'), html: emailLayout(subject, lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('\n')) });
  }

  // ── The company's own dashboard ──────────────────────────────────────────

  async me(userId: string) {
    const org = await companyOfAdmin(userId);
    return {
      company: {
        _id: org._id.toString(),
        name: org.name,
        status: org.status,
        domains: org.domains,
        contributionPaused: Boolean(org.billingHold),
        policy: {
          sharePercent: org.policy?.sharePercent ?? 0,
          monthlyCapUsd: org.policy?.monthlyCapUsd ?? 0,
          weekdaysOnly: org.policy?.weekdaysOnly ?? true,
          sites: (org.policy?.sites ?? []).map((s) => ({ name: s.name, address: s.address, radiusKm: s.radiusKm })),
        },
      },
    };
  }

  /** A month's figures: members, trips the company paid towards, what it paid, CO₂ saved */
  async overview(userId: string, monthInput?: unknown) {
    const org = await companyOfAdmin(userId);
    const month = typeof monthInput === 'string' && /^\d{4}-\d{2}$/.test(monthInput) ? monthInput : toLocalClock(new Date()).toISOString().slice(0, 7);
    const [members, [totals], [newMembers]] = await Promise.all([
      User.countDocuments({ 'work.organisation': org._id }),
      Booking.aggregate<{ trips: number; spend: number; fares: number; co2: number; riders: number }>([
        { $match: { organisation: org._id, companyMonth: month, status: BookingStatus.COMPLETED } },
        { $group: { _id: null, trips: { $sum: 1 }, spend: { $sum: '$companyShare' }, fares: { $sum: '$estimatedFare' }, co2: { $sum: '$co2SavedKg' }, riders: { $addToSet: '$rider' } } },
        { $project: { trips: 1, spend: 1, fares: 1, co2: 1, riders: { $size: '$riders' } } },
      ]),
      User.aggregate<{ n: number }>([
        { $match: { 'work.organisation': org._id, 'work.verifiedAt': { $gte: new Date(`${month}-01T00:00:00Z`) } } },
        { $count: 'n' },
      ]),
    ]);
    return {
      month,
      members,
      newMembers: newMembers?.n ?? 0,
      ridersThisMonth: totals?.riders ?? 0,
      trips: totals?.trips ?? 0,
      companyPaid: round2(totals?.spend ?? 0),
      staffPaid: round2((totals?.fares ?? 0) - (totals?.spend ?? 0)),
      co2SavedKg: round2(totals?.co2 ?? 0),
    };
  }

  /** Who has joined, with this month's trips and what the company paid for each person */
  async members(userId: string) {
    const org = await companyOfAdmin(userId);
    const month = toLocalClock(new Date()).toISOString().slice(0, 7);
    const [people, usage] = await Promise.all([
      User.find({ 'work.organisation': org._id }).select('name work.email work.verifiedAt').sort({ name: 1 }).lean(),
      Booking.aggregate<{ _id: Types.ObjectId; trips: number; paid: number }>([
        { $match: { organisation: org._id, companyMonth: month, status: BookingStatus.COMPLETED } },
        { $group: { _id: '$rider', trips: { $sum: 1 }, paid: { $sum: '$companyShare' } } },
      ]),
    ]);
    const byPerson = new Map(usage.map((u) => [u._id.toString(), u]));
    return {
      month,
      members: people.map((p) => ({
        _id: p._id.toString(),
        name: p.name,
        email: p.work?.email,
        joinedAt: p.work?.verifiedAt,
        tripsThisMonth: byPerson.get(p._id.toString())?.trips ?? 0,
        companyPaidThisMonth: round2(byPerson.get(p._id.toString())?.paid ?? 0),
      })),
    };
  }

  /** Someone has left the company: they leave the programme */
  async removeMember(userId: string, memberId: string) {
    const org = await companyOfAdmin(userId);
    const done = await User.updateOne({ _id: memberId, 'work.organisation': org._id }, { $unset: { work: 1 } });
    if (!done.modifiedCount) throw new NotFoundError('Member');
    await audit(userId, 'company.removeMember', 'organisation', org._id.toString(), undefined, { memberId });
    return { removed: true };
  }

  async bills(userId: string) {
    const org = await companyOfAdmin(userId);
    const invoices = await CompanyInvoice.find({ organisation: org._id }).select('-lines').sort({ month: -1 }).lean();
    return { invoices: invoices.map((i) => invoiceView(i)) };
  }

  async billFile(userId: string, invoiceId: string, format: 'pdf' | 'xlsx') {
    const org = await companyOfAdmin(userId);
    if (!Types.ObjectId.isValid(invoiceId) || !(await CompanyInvoice.exists({ _id: invoiceId, organisation: org._id }))) throw new NotFoundError('Bill');
    return this.invoices.file(invoiceId, format);
  }
}
