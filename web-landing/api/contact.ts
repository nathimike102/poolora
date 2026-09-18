import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

/**
 * Serverless email endpoint (Vercel Function).
 *
 * Receives waitlist / investor submissions and relays them over SMTP. All
 * credentials come from environment variables, nothing is hard-coded. See
 * DEPLOYMENT.md for the required variables and Vercel setup.
 *
 * Abuse controls, in the order they run: honeypot field, per-IP rate limit,
 * and Cloudflare Turnstile when TURNSTILE_SECRET_KEY is configured.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Per-IP submission limit. */
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

/**
 * Best-effort in-memory limiter. A serverless function may be replaced or run
 * in parallel instances, so this thins out casual abuse rather than acting as a
 * hard guarantee. Turnstile is the control that holds under a real flood.
 */
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);

  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (times.every(t => now - t >= RATE_LIMIT_WINDOW_MS)) hits.delete(key);
    }
  }
  return recent.length > RATE_LIMIT_MAX;
}

function clientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (value?.split(',')[0] ?? req.socket?.remoteAddress ?? 'unknown').trim();
}

interface ContactBody {
  type?: 'waitlist' | 'investor';
  name?: string;
  email?: string;
  city?: string;
  role?: string;
  org?: string;
  range?: string;
  message?: string;
  consent?: boolean;
  website?: string;
  turnstileToken?: string;
  attribution?: Record<string, string>;
}

function validate(body: ContactBody): string | null {
  if (body.type !== 'waitlist' && body.type !== 'investor') return 'Invalid submission type.';
  if (!body.name?.trim()) return 'Name is required.';
  if (!body.email || !EMAIL_RE.test(body.email)) return 'A valid email is required.';
  if (body.consent !== true) return 'Consent is required.';
  if (body.type === 'waitlist') {
    if (!body.city) return 'City is required.';
    if (!body.role) return 'Role is required.';
  } else if (!body.range) {
    return 'Investment stage is required.';
  }
  return null;
}

async function turnstilePassed(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // Not configured: the other controls apply.
  if (!token) return false;

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error('Turnstile verification failed:', err);
    return false;
  }
}

function formatAttribution(attribution: Record<string, string> | undefined): string {
  const entries = Object.entries(attribution ?? {});
  if (entries.length === 0) return 'Source: direct (no campaign parameters)';
  return ['Source:', ...entries.map(([k, v]) => `  ${k}: ${v}`)].join('\n');
}

function buildEmail(body: ContactBody): { subject: string; text: string } {
  const source = formatAttribution(body.attribution);

  if (body.type === 'investor') {
    return {
      subject: `New investor enquiry: ${body.name}`,
      text: [
        `Name: ${body.name}`,
        `Organisation: ${body.org || 'Not given'}`,
        `Email: ${body.email}`,
        `Invests at: ${body.range}`,
        `Message: ${body.message || 'None'}`,
        '',
        source,
      ].join('\n'),
    };
  }
  return {
    subject: `New waitlist signup: ${body.name}`,
    text: [
      `Name: ${body.name}`,
      `Email: ${body.email}`,
      `City: ${body.city}`,
      `Role: ${body.role}`,
      '',
      source,
    ].join('\n'),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const body = ((typeof req.body === 'string' ? safeParse(req.body) : req.body) ?? {}) as ContactBody;

  // Honeypot: a hidden field only a bot fills in. Answer as if it worked.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return res.status(200).json({ ok: true });
  }

  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'Too many submissions. Please try again later.' });
  }

  const validationError = validate(body);
  if (validationError) return res.status(400).json({ error: validationError });

  if (!(await turnstilePassed(body.turnstileToken, ip))) {
    return res.status(400).json({ error: 'Could not verify that you are human. Please try again.' });
  }

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_SECURE,
    CONTACT_FROM_EMAIL,
    CONTACT_TO_EMAIL,
    INVESTORS_FROM_EMAIL,
    INVESTORS_TO_EMAIL,
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    console.error('Mailer is not configured: missing SMTP transport environment variables.');
    return res.status(500).json({ error: 'Email service is not configured.' });
  }

  // Each form routes to its own sender/recipient (see DEPLOYMENT.md).
  const routing =
    body.type === 'investor'
      ? { from: INVESTORS_FROM_EMAIL, to: INVESTORS_TO_EMAIL }
      : { from: CONTACT_FROM_EMAIL, to: CONTACT_TO_EMAIL };

  if (!routing.from || !routing.to) {
    console.error(`Mailer is not configured: missing routing for "${body.type}" submissions.`);
    return res.status(500).json({ error: 'Email service is not configured.' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: SMTP_SECURE ? SMTP_SECURE === 'true' : Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    const { subject, text } = buildEmail(body);

    await transporter.sendMail({
      from: routing.from,
      to: routing.to,
      replyTo: body.email,
      subject,
      text,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Failed to send contact email:', err);
    return res.status(502).json({ error: 'Could not send your message. Please try again later.' });
  }
}

function safeParse(value: string): ContactBody {
  try {
    return JSON.parse(value) as ContactBody;
  } catch {
    return {};
  }
}
