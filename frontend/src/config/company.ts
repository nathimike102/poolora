/**
 * config/company.ts
 *
 * Official contact details and legal links. Keep in sync with
 * web-landing/src/config/company.ts, which is the source of truth.
 */
/** Public site origin. Mirrors SITE_ORIGIN in web-landing/src/config/company.ts. */
const SITE_ORIGIN = 'https://poolora.vercel.app';

/** Mirrors PUBLIC_EMAIL in web-landing/src/config/company.ts. */
const PUBLIC_EMAIL = 'nathimike102@gmail.com';

export const COMPANY = {
  name: 'Poolora',
  website: SITE_ORIGIN,
  supportEmail: PUBLIC_EMAIL,
  supportPhone: '+919848377713',
  supportPhoneDisplay: '+91 98483 77713',
  privacyUrl: `${SITE_ORIGIN}/privacy`,
  termsUrl: `${SITE_ORIGIN}/terms`,
  faqUrl: `${SITE_ORIGIN}/#faq`,
} as const;
