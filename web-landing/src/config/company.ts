/**
 * The official public-facing role addresses. These are the only email
 * addresses that should appear anywhere on the site. Import them from here
 * rather than hard-coding an address.
 *
 *  - support:   customer support, help, assistance (support@)
 *  - contact:   general, partnership, business and legal enquiries (hello@)
 *  - investors: investment and fundraising enquiries (hello@)
 *  - privacy:   data protection and data subject requests (privacy@)
 *  - security:  vulnerability reports, published in security.txt (security@)
 */
export interface CompanyEmails {
  support: string;
  contact: string;
  investors: string;
  privacy: string;
  security: string;
}

export interface CompanyFounder {
  name: string;
  title: string;
}

/**
 * Social profiles. Leave a value empty ("") when there is no official account.
 * Empty links are never rendered, so the UI never shows a broken or placeholder
 * icon. Add a real URL here later and the icon appears automatically; no UI
 * changes are required.
 */
export interface CompanySocial {
  linkedin: string;
  x: string;
  instagram: string;
  facebook: string;
  youtube: string;
  github: string;
}

export interface CompanyLaunch {
  status: string;
}

export interface CompanyConfig {
  name: string;
  tagline: string;
  website: string;
  emails: CompanyEmails;
  phone: string;
  address: string;
  founder: CompanyFounder;
  social: CompanySocial;
  launch: CompanyLaunch;
  appStore: string;
  playStore: string;
  description: string;
  copyright: string;
}

/**
 * Public site origin. Vercel serves the project at <project>.vercel.app, so
 * this tracks the Vercel project name. Change it here only.
 */
const SITE_ORIGIN = "https://poolora.vercel.app";

/**
 * The inbox that works today. Every address falls back to it until
 * MAIL_DOMAIN is set.
 */
const PUBLIC_EMAIL = "nathimike102@icloud.com";

/**
 * The company domain the role addresses live on, e.g. "poolora.co.zw". Set it
 * only once its mailboxes receive mail (docs/GO_LIVE_GUIDE.md, Email): then
 * support@, hello@, privacy@ and security@ replace PUBLIC_EMAIL across the
 * site, security.txt and (through its mirror) the app.
 */
const MAIL_DOMAIN = "";

const role = (mailbox: string) => (MAIL_DOMAIN ? `${mailbox}@${MAIL_DOMAIN}` : PUBLIC_EMAIL);

export const COMPANY: CompanyConfig = {
  name: "Poolora",
  tagline: "Share the ride, split the cost",
  website: SITE_ORIGIN,
  emails: {
    support: role("support"),
    contact: role("hello"),
    investors: role("hello"),
    privacy: role("privacy"),
    security: role("security"),
  },
  // The founder's current number; swap in a +263 line when there is one
  phone: "+91 90322 32881",
  address: "Bulawayo, Zimbabwe",
  founder: {
    name: "N. M. Sibanda",
    title: "Founder",
  },
  // The founder's own profiles until Poolora has company accounts
  social: {
    linkedin: "https://www.linkedin.com/in/nkosinathi-sibanda-294155131/",
    x: "",
    instagram: "",
    facebook: "",
    youtube: "",
    github: "https://github.com/nathimike102",
  },
  launch: {
    status: "In development",
  },
  appStore: "#",
  playStore: "#",
  description: "Poolora is a carpooling app in development, launching first in Zimbabwe. Drivers offer empty seats on journeys they are already making, riders book a seat at the price the driver sets, and safety tools are part of every ride.",
  copyright: `© ${new Date().getFullYear()} Poolora. All rights reserved.`,
};
