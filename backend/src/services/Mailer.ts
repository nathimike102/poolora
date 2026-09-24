/**
 * Mailer.ts
 *
 * Email over SMTP, so any provider works (Amazon SES, Zoho, Google
 * Workspace, SendGrid or Mailgun SMTP). Set SMTP_HOST, SMTP_PORT,
 * SMTP_SECURE, SMTP_USER, SMTP_PASS and MAIL_FROM. Without SMTP_HOST mail is
 * skipped and logged, so nothing else depends on email being set up.
 */

import nodemailer, { type Transporter } from 'nodemailer';
import { logger } from '../utils/logger';

export interface Mail {
  to: string;
  subject: string;
  /** Plain text is always sent; HTML is optional */
  text: string;
  html?: string;
  attachments?: Array<{ filename: string; content: string; contentType: string }>;
}

let transporter: Transporter | null = null;

export function mailEnabled(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

function transport(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transporter;
}

/** Sends one email. Never throws: a mail failure must not undo the action that sent it. */
export async function sendMail(mail: Mail): Promise<boolean> {
  if (!mailEnabled()) {
    logger.debug('Email not configured; skipped', { subject: mail.subject });
    return false;
  }
  if (!mail.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.to)) return false;
  try {
    await transport().sendMail({
      from: process.env.MAIL_FROM || 'Poolora <no-reply@poolora.app>',
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      attachments: mail.attachments,
    });
    return true;
  } catch (error) {
    logger.error('Email failed', { subject: mail.subject, error: (error as Error).message });
    return false;
  }
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** A plain, readable email layout that works in every client */
export function emailLayout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f6f6f4;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e2e1dc;border-radius:8px" cellpadding="0" cellspacing="0">
<tr><td style="padding:24px 28px">
<div style="font-size:14px;font-weight:bold;color:#0b7a75;margin-bottom:12px">Poolora</div>
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>
${bodyHtml}
</td></tr></table>
<p style="font-size:12px;color:#75746f;margin:16px 0 0">You are receiving this because you use Poolora.</p>
</td></tr></table></body></html>`;
}

/** Emails a user by id, when they have an address. For notices that also go out as pushes. */
export async function emailUser(userId: string, subject: string, message: string): Promise<boolean> {
  if (!mailEnabled()) return false;
  const { User } = await import('../models/User');
  const user = await User.findById(userId).select('email name').lean();
  if (!user?.email) return false;
  const greeting = user.name ? `Hi ${user.name.split(' ')[0]},` : 'Hi,';
  return sendMail({
    to: user.email,
    subject,
    text: `${greeting}\n\n${message}\n\nPoolora`,
    html: emailLayout(subject, `<p>${escapeHtml(greeting)}</p><p style="line-height:1.5">${escapeHtml(message).replace(/\n/g, '<br>')}</p>`),
  });
}
