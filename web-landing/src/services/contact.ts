/**
 * Client-side contact/email service.
 *
 * The UI calls {@link submitContact}, which posts to the `/api/contact`
 * serverless function (see `api/contact.ts`). No SMTP logic or secrets live on
 * the client. When a backend API is introduced later, only `ENDPOINT` and the
 * payload types here need to change, and the form components stay the same.
 */

import { getAttribution, type Attribution } from './attribution';

const ENDPOINT = '/api/contact';

export type ContactType = 'waitlist' | 'investor';

interface BasePayload {
  name: string;
  email: string;
  /** The person ticked the consent box on the form. */
  consent: boolean;
  /** Cloudflare Turnstile token, when the widget is enabled. */
  turnstileToken?: string;
  /** Honeypot: must stay empty. Real people never see this field. */
  website?: string;
}

export interface WaitlistPayload extends BasePayload {
  type: 'waitlist';
  city: string;
  role: string;
}

export interface InvestorPayload extends BasePayload {
  type: 'investor';
  org: string;
  range: string;
  message: string;
}

export type ContactPayload = WaitlistPayload | InvestorPayload;

export interface SubmitResult {
  ok: boolean;
  /** User-facing error message when `ok` is false. */
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** Returns a user-facing validation message, or null when the payload is valid. */
export function validateContact(payload: ContactPayload): string | null {
  if (!payload.name.trim()) return 'Please enter your name.';
  if (!isValidEmail(payload.email)) return 'Please enter a valid email address.';
  if (!payload.consent) return 'Please tick the box so we know we may contact you.';

  if (payload.type === 'waitlist') {
    if (!payload.city) return 'Please select your city.';
    if (!payload.role) return 'Please tell us how you plan to use Poolora.';
  } else {
    if (!payload.range) return 'Please select the stage you invest at.';
  }
  return null;
}

export async function submitContact(payload: ContactPayload): Promise<SubmitResult> {
  const validationError = validateContact(payload);
  if (validationError) return { ok: false, error: validationError };

  const body: ContactPayload & { attribution: Attribution } = {
    ...payload,
    attribution: getAttribution(),
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: data?.error ?? 'Something went wrong. Please try again.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error. Please check your connection and try again.' };
  }
}
