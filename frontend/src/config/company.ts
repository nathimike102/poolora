/**
 * config/company.ts
 *
 * Official contact details and legal links. Keep in sync with
 * web-landing/src/config/company.ts, which is the source of truth.
 */
/** Public site origin. Mirrors SITE_ORIGIN in web-landing/src/config/company.ts. */
const SITE_ORIGIN = 'https://siham.vercel.app';

/** Mirrors PUBLIC_EMAIL in web-landing/src/config/company.ts. */
const PUBLIC_EMAIL = 'nathimike102@icloud.com';

/** Mirrors MAIL_DOMAIN in web-landing/src/config/company.ts: empty until the domain's mailboxes work. */
const MAIL_DOMAIN = '';

const role = (mailbox: string) => (MAIL_DOMAIN ? `${mailbox}@${MAIL_DOMAIN}` : PUBLIC_EMAIL);

export const COMPANY = {
  name: 'Siham',
  website: SITE_ORIGIN,
  supportEmail: role('support'),
  privacyUrl: `${SITE_ORIGIN}/privacy`,
  termsUrl: `${SITE_ORIGIN}/terms`,
  faqUrl: `${SITE_ORIGIN}/#faq`,
} as const;
