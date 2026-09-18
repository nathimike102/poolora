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

export const COMPANY: CompanyConfig = {
  name: "Sanchari",
  tagline: "Share the ride, split the cost",
  website: "https://sanchari.me",
  emails: {
    support: "support@sanchari.me",
    contact: "contact@sanchari.me",
    investors: "investors@sanchari.me",
  },
  phone: "+91 9848377713",
  address: "Surampalem, Andhra Pradesh, India",
  founder: {
    name: "M. Lakshmi Narayana",
    title: "Founder",
  },
  social: {
    linkedin: "",
    x: "",
    instagram: "",
    facebook: "",
    youtube: "",
    github: "",
  },
  launch: {
    status: "In development",
  },
  appStore: "#",
  playStore: "#",
  description: "Sanchari is a carpooling app for India, in development. Drivers offer empty seats on journeys they are already making, riders book a seat at the price the driver sets, and safety tools are part of every ride.",
  copyright: `© ${new Date().getFullYear()} Sanchari. All rights reserved.`,
};
