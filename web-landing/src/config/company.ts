/**
 * The three official public-facing email addresses. These are the only email
 * addresses that should appear anywhere on the site. Import them from here
 * rather than hard-coding an address.
 *
 *  - support:   customer support, help, assistance
 *  - contact:   general / partnership / business / privacy / legal enquiries
 *  - investors: investment and fundraising enquiries
 */
export interface CompanyEmails {
  support: string;
  contact: string;
  investors: string;
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
 * Single public inbox for the whole site and app.
 *
 * The support / contact / investors fields below are kept separate so the
 * legal pages can keep addressing them by purpose, and so they can be split
 * onto different inboxes later without touching any page.
 */
const PUBLIC_EMAIL = "nathimike102@icloud.com";

export const COMPANY: CompanyConfig = {
  name: "Poolora",
  tagline: "Share the ride, split the cost",
  website: SITE_ORIGIN,
  emails: {
    support: PUBLIC_EMAIL,
    contact: PUBLIC_EMAIL,
    investors: PUBLIC_EMAIL,
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
