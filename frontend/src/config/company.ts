/**
 * config/company.ts
 *
 * Official contact details and legal links. Keep in sync with
 * web-landing/src/config/company.ts, which is the source of truth.
 */
/** Public site origin. Mirrors SITE_ORIGIN in web-landing/src/config/company.ts. */
const SITE_ORIGIN = 'https://sanchari.vercel.app';

/** Mirrors PUBLIC_EMAIL in web-landing/src/config/company.ts. See the note there. */
const PUBLIC_EMAIL = 'hello@sanchari.invalid';

export const COMPANY = {
  name: 'Sanchari',
  website: SITE_ORIGIN,
  supportEmail: PUBLIC_EMAIL,
  supportPhone: '+919848377713',
  supportPhoneDisplay: '+91 98483 77713',
  privacyUrl: `${SITE_ORIGIN}/privacy`,
  termsUrl: `${SITE_ORIGIN}/terms`,
  faqUrl: `${SITE_ORIGIN}/#faq`,
} as const;
