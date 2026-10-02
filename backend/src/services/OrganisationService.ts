/**
 * OrganisationService.ts
 *
 * Company programmes (UC-C01, UC-C02). An admin sets up a company with its
 * email domains; staff join by confirming a work email on one of them. The
 * link opens a page with a Confirm button rather than confirming on open,
 * because mail scanners open links in messages before people do.
 */

import crypto from 'crypto';
import { Types } from 'mongoose';
import { config } from '../config';
import { Organisation, IOrganisation } from '../models/Organisation';
import { User } from '../models/User';
import { AppError, ConflictError, NotFoundError } from '../utils/AppError';
import { audit } from './AuditService';
import { emailLayout, escapeHtml, mailEnabled, sendMail } from './Mailer';
import { phrase, translate } from '../i18n';
import { NotificationService } from './NotificationService';

/** How long a work-email link works (UC-C02 3a) */
export const WORK_LINK_TTL_MS = 24 * 3_600_000;
/** At most one link per person in this time */
const RESEND_AFTER_MS = 10 * 60_000;

/**
 * Addresses anyone can get. A company's domain must be its own, or anyone
 * could join its programme and ride at its expense.
 */
const FREE_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'outlook.com', 'hotmail.com', 'live.com',
  'msn.com', 'icloud.com', 'me.com', 'aol.com', 'protonmail.com', 'proton.me', 'mail.com', 'gmx.com', 'zoho.com',
  'yandex.com', 'zol.co.zw',
]);

const DOMAIN = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const EMAIL = /^[^\s@]+@([^\s@]+)$/;

const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
const domainOf = (email: string) => EMAIL.exec(email.trim().toLowerCase())?.[1] ?? null;

type OrganisationInput = {
  name?: unknown;
  domains?: unknown;
  billingContact?: { name?: unknown; email?: unknown; phone?: unknown };
  status?: unknown;
  notes?: unknown;
};

function cleanDomains(value: unknown): string[] {
  if (!Array.isArray(value)) throw new AppError('Give the company\'s email domains', 422, 'VALIDATION_ERROR');
  const domains = [...new Set(value.map((d) => String(d).trim().toLowerCase().replace(/^@/, '')).filter(Boolean))];
  if (domains.length < 1 || domains.length > 10) throw new AppError('Give between 1 and 10 email domains', 422, 'VALIDATION_ERROR');
  for (const d of domains) {
    if (!DOMAIN.test(d)) throw new AppError(`"${d}" is not an email domain`, 422, 'VALIDATION_ERROR');
    if (FREE_DOMAINS.has(d)) throw new AppError(`${d} is a public email service; use the company's own domain`, 422, 'PUBLIC_DOMAIN');
  }
  return domains;
}

function view(org: IOrganisation | (Record<string, unknown> & { _id: Types.ObjectId }), members?: number) {
  const o = org as IOrganisation;
  return {
    _id: o._id.toString(),
    name: o.name,
    domains: o.domains,
    billingContact: o.billingContact,
    status: o.status,
    notes: o.notes,
    createdAt: o.createdAt,
    ...(members === undefined ? {} : { members }),
  };
}

export class OrganisationService {
  // ── Admin (UC-C01) ───────────────────────────────────────────────────────

  async list() {
    const [orgs, counts] = await Promise.all([
      Organisation.find().sort({ name: 1 }).lean(),
      User.aggregate<{ _id: Types.ObjectId; n: number }>([
        { $match: { 'work.organisation': { $exists: true } } },
        { $group: { _id: '$work.organisation', n: { $sum: 1 } } },
      ]),
    ]);
    const n = new Map(counts.map((c) => [c._id.toString(), c.n]));
    return { organisations: orgs.map((o) => view(o, n.get(o._id.toString()) ?? 0)) };
  }

  async get(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Company');
    const org = await Organisation.findById(id).lean();
    if (!org) throw new NotFoundError('Company');
    const members = await User.find({ 'work.organisation': org._id })
      .select('name phone work.email work.verifiedAt capabilities')
      .sort({ 'work.verifiedAt': -1 })
      .lean();
    return {
      organisation: view(org, members.length),
      members: members.map((m) => ({
        _id: m._id.toString(),
        name: m.name,
        phone: m.phone,
        email: m.work?.email,
        joinedAt: m.work?.verifiedAt,
        driver: (m.capabilities ?? []).includes('driver' as never),
      })),
    };
  }

  async create(input: OrganisationInput, adminId: string) {
    const name = String(input.name ?? '').trim();
    if (name.length < 2) throw new AppError('Give the company\'s name', 422, 'VALIDATION_ERROR');
    const domains = cleanDomains(input.domains);
    const billingContact = this.cleanContact(input.billingContact);
    await this.assertDomainsFree(domains);
    const org = await Organisation.create({
      name,
      domains,
      billingContact,
      notes: typeof input.notes === 'string' ? input.notes.trim().slice(0, 2000) : undefined,
      createdBy: adminId,
    });
    await audit(adminId, 'organisation.create', 'organisation', org._id.toString(), undefined, { name, domains });
    return { organisation: view(org, 0) };
  }

  async update(id: string, input: OrganisationInput, adminId: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Company');
    const org = await Organisation.findById(id);
    if (!org) throw new NotFoundError('Company');
    const changed: string[] = [];
    if (input.name !== undefined) {
      const name = String(input.name).trim();
      if (name.length < 2) throw new AppError('Give the company\'s name', 422, 'VALIDATION_ERROR');
      org.name = name;
      changed.push('name');
    }
    if (input.domains !== undefined) {
      const domains = cleanDomains(input.domains);
      await this.assertDomainsFree(domains, org._id);
      org.domains = domains;
      changed.push('domains');
    }
    if (input.billingContact !== undefined) {
      org.billingContact = this.cleanContact(input.billingContact);
      changed.push('billing contact');
    }
    if (input.status !== undefined) {
      if (input.status !== 'active' && input.status !== 'suspended') throw new AppError('Status is active or suspended', 422, 'VALIDATION_ERROR');
      org.status = input.status;
      changed.push('status');
    }
    if (input.notes !== undefined) {
      org.notes = String(input.notes).trim().slice(0, 2000) || undefined;
      changed.push('notes');
    }
    await org.save();
    // Members already in stay; a removed domain only stops new people joining with it
    await audit(adminId, 'organisation.update', 'organisation', id, undefined, { changed });
    return { organisation: view(org) };
  }

  /** Removes someone from the company, e.g. when they leave it */
  async removeMember(id: string, userId: string, adminId: string, reason?: unknown) {
    const done = await User.updateOne({ _id: userId, 'work.organisation': id }, { $unset: { work: 1 } });
    if (!done.modifiedCount) throw new NotFoundError('Member');
    await audit(adminId, 'organisation.removeMember', 'organisation', id, typeof reason === 'string' ? reason : undefined, { userId });
    return { removed: true };
  }

  private cleanContact(value: OrganisationInput['billingContact']) {
    const name = String(value?.name ?? '').trim();
    const email = String(value?.email ?? '').trim().toLowerCase();
    if (name.length < 2) throw new AppError('Give the billing contact\'s name', 422, 'VALIDATION_ERROR');
    if (!domainOf(email)) throw new AppError('Give the billing contact\'s email address', 422, 'VALIDATION_ERROR');
    const phone = value?.phone ? String(value.phone).trim().slice(0, 30) : undefined;
    return { name, email, ...(phone ? { phone } : {}) };
  }

  private async assertDomainsFree(domains: string[], except?: Types.ObjectId) {
    const taken = await Organisation.findOne({ domains: { $in: domains }, ...(except ? { _id: { $ne: except } } : {}) }).select('name domains').lean();
    if (taken) {
      const clash = taken.domains.find((d) => domains.includes(d));
      throw new ConflictError(`${clash} already belongs to ${taken.name}`);
    }
  }

  // ── Members (UC-C02) ─────────────────────────────────────────────────────

  /** The caller's company, or the address waiting to be confirmed */
  async status(userId: string) {
    const user = await User.findById(userId).select('work +workPending').populate<{ work?: { organisation: IOrganisation; email: string; verifiedAt: Date } }>('work.organisation', 'name status').lean();
    if (!user) throw new NotFoundError('User');
    const pending = user.workPending && user.workPending.sentAt.getTime() > Date.now() - WORK_LINK_TTL_MS
      ? { email: user.workPending.email, sentAt: user.workPending.sentAt }
      : null;
    const org = user.work?.organisation as unknown as IOrganisation | undefined;
    return {
      work: user.work && org
        ? { organisation: { _id: org._id.toString(), name: org.name, active: org.status === 'active' }, email: user.work.email, since: user.work.verifiedAt }
        : null,
      pending,
    };
  }

  /** Sends a link to the work address; the person joins when they confirm it */
  async requestJoin(userId: string, emailInput: unknown) {
    const email = String(emailInput ?? '').trim().toLowerCase();
    const domain = domainOf(email);
    if (!domain || email.length > 254) throw new AppError('Enter your work email address', 422, 'VALIDATION_ERROR');
    const org = await Organisation.findOne({ domains: domain, status: 'active' }).lean();
    if (!org) {
      throw new AppError('Your company is not on Poolora yet. Ask your HR team to get in touch with us.', 404, 'NO_COMPANY_PROGRAMME');
    }
    const user = await User.findById(userId).select('name language work +workPending');
    if (!user) throw new NotFoundError('User');
    if (user.work?.email === email) throw new ConflictError('This is already your work email');
    if (await User.exists({ 'work.email': email, _id: { $ne: user._id } })) {
      throw new ConflictError('This work email is linked to another Poolora account. Contact support if it is yours.');
    }
    if (user.workPending && Date.now() - user.workPending.sentAt.getTime() < RESEND_AFTER_MS) {
      throw new AppError('We sent a link a few minutes ago. Check your inbox, or wait 10 minutes to send another.', 429, 'WORK_LINK_RATE_LIMITED');
    }
    if (!mailEnabled()) throw new AppError('Email is not available right now. Try again later.', 503, 'MAIL_UNAVAILABLE');

    const token = crypto.randomBytes(24).toString('base64url');
    user.workPending = { organisation: org._id, email, tokenHash: hash(token), sentAt: new Date() };
    await user.save();

    const url = `${config.app.baseUrl.replace(/\/$/, '')}/track/work/${token}`;
    const lang = user.language;
    const subject = translate(lang, 'work.email.subject', { company: org.name });
    const body = translate(lang, 'work.email.body', { name: user.name.split(' ')[0], company: org.name });
    const ignore = translate(lang, 'work.email.ignore');
    const sent = await sendMail({
      to: email,
      subject,
      text: `${body}\n\n${url}\n\n${ignore}`,
      html: emailLayout(subject, `<p>${escapeHtml(body)}</p>
<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 18px;background:#0B7A75;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">${escapeHtml(translate(lang, 'work.email.button'))}</a></p>
<p style="color:#75746f;font-size:13px">${escapeHtml(ignore)}</p>`),
    });
    if (!sent) throw new AppError('The email could not be sent. Try again later.', 503, 'MAIL_UNAVAILABLE');
    return { sentTo: email, company: org.name };
  }

  /** For the confirmation page: who the link is for, without confirming */
  async peek(token: string) {
    const found = await this.findByToken(token);
    if (!found) return null;
    return { firstName: found.user.name.split(' ')[0], company: found.org.name, email: found.email };
  }

  /** The person pressed Confirm on the page: they are a member now */
  async confirm(token: string) {
    const found = await this.findByToken(token);
    if (!found) return null;
    const { user, org, email } = found;
    if (await User.exists({ 'work.email': email, _id: { $ne: user._id } })) return null;
    const claimed = await User.updateOne(
      { _id: user._id, 'workPending.tokenHash': hash(token) },
      { $set: { work: { organisation: org._id, email, verifiedAt: new Date() } }, $unset: { workPending: 1 } },
    );
    if (!claimed.modifiedCount) return null;
    const n = new NotificationService();
    const title = phrase('work.joinedTitle');
    const body = phrase('work.joinedBody', { company: org.name });
    await Promise.allSettled([
      n.createNotification(user._id.toString(), title, body, 'system'),
      n.sendPushNotification(user._id.toString(), title, body, { type: 'work' }),
    ]);
    return { firstName: user.name.split(' ')[0], company: org.name };
  }

  /** The member leaves their company's programme */
  async leave(userId: string) {
    await User.updateOne({ _id: userId }, { $unset: { work: 1, workPending: 1 } });
    return { left: true };
  }

  private async findByToken(token: string) {
    if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return null;
    const user = await User.findOne({
      'workPending.tokenHash': hash(token),
      'workPending.sentAt': { $gt: new Date(Date.now() - WORK_LINK_TTL_MS) },
    }).select('name +workPending');
    if (!user?.workPending) return null;
    const org = await Organisation.findOne({ _id: user.workPending.organisation, status: 'active' }).lean();
    if (!org) return null;
    // The domain may have been removed from the company since the link was sent
    if (!org.domains.includes(domainOf(user.workPending.email) ?? '')) return null;
    return { user, org, email: user.workPending.email };
  }
}
