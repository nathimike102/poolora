import { COMPANY } from './company';

/**
 * Centralized site configuration.
 *
 * This is the single place to edit public, build-time values: branding, SEO,
 * the production domain and analytics. Company facts (name, emails, phone,
 * address, social links) live in `company.ts` and are re-used here so there is
 * one source of truth.
 *
 * Secrets (SMTP credentials, mail recipients) are NOT kept here. They are read
 * from environment variables by the serverless function in `api/contact.ts`.
 * See DEPLOYMENT.md.
 */
export interface SiteConfig {
  name: string;
  /** Bare domain, e.g. "sanchari.me". */
  domain: string;
  /** Canonical absolute URL, no trailing slash. */
  url: string;
  themeColor: string;
  seo: {
    title: string;
    description: string;
    keywords: string[];
    /** Absolute or root-relative path to a 1200×630 image. Empty = omit. */
    ogImage: string;
    locale: string;
    /** Twitter handle including the leading "@". Empty = omit. */
    twitterHandle: string;
  };
  analytics: {
    /** Google Analytics 4 measurement id, e.g. "G-XXXXXXXXXX". Empty = disabled. */
    googleAnalyticsId: string;
  };
}

export const siteConfig: SiteConfig = {
  name: COMPANY.name,
  domain: 'sanchari.me',
  url: COMPANY.website,
  themeColor: '#0B7A75',
  seo: {
    title: `${COMPANY.name}: carpooling for India`,
    description: COMPANY.description,
    keywords: [
      'ride pooling',
      'carpooling India',
      'parcel pooling',
      'trip pooling',
      'women safety',
      'driver verification',
      'smart mobility',
      'shared rides',
    ],
    ogImage: '',
    locale: 'en_IN',
    twitterHandle: '',
  },
  analytics: {
    googleAnalyticsId: '',
  },
};
