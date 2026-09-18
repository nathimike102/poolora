/**
 * Consent for non-essential tracking.
 *
 * Nothing that identifies a visitor loads until they say yes. We publish Google
 * Consent Mode v2 defaults as denied before any tag could run, and we treat a
 * Global Privacy Control signal as a decision already made, so those visitors
 * are never asked.
 */

import { siteConfig } from '../config/site';

const STORAGE_KEY = 'sanchari.consent';

export type ConsentChoice = 'granted' | 'denied';

type ConsentModeArgs =
  | ['consent', 'default' | 'update', Record<string, ConsentChoice>]
  | ['js', Date]
  | ['config', string, Record<string, unknown>?];

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: ConsentModeArgs) => void;
  }
  interface Navigator {
    /** Global Privacy Control, set by browsers and extensions that support it. */
    globalPrivacyControl?: boolean;
  }
}

/** True when the visitor's browser asks us not to share or sell their data. */
export function gpcEnabled(): boolean {
  return typeof navigator !== 'undefined' && navigator.globalPrivacyControl === true;
}

export function storedChoice(): ConsentChoice | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

/** Whether the banner still has a question to ask. */
export function needsDecision(): boolean {
  return !gpcEnabled() && storedChoice() === null;
}

function pushConsent(mode: 'default' | 'update', choice: ConsentChoice) {
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtag(...args: ConsentModeArgs) {
      window.dataLayer!.push(args);
    };
  }
  window.gtag('consent', mode, {
    ad_storage: choice,
    ad_user_data: choice,
    ad_personalization: choice,
    analytics_storage: choice,
    functionality_storage: 'granted',
    security_storage: 'granted',
  });
}

/**
 * Publishes the denied-by-default state. Called once, as early as the app
 * starts, before anything could load a tag.
 */
export function initConsent(): void {
  if (typeof window === 'undefined') return;
  pushConsent('default', 'denied');

  if (!gpcEnabled() && storedChoice() === 'granted') loadAnalytics();
}

function loadAnalytics(): void {
  const id = siteConfig.analytics.googleAnalyticsId;
  if (!id) return;
  if (document.getElementById('ga-script')) return;

  const script = document.createElement('script');
  script.id = 'ga-script';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);

  window.gtag!('js', new Date());
  window.gtag!('config', id, { anonymize_ip: true });
}

export function setConsent(choice: ConsentChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Storage blocked. The choice then applies to this page view only.
  }
  pushConsent('update', choice);
  if (choice === 'granted') loadAnalytics();
}

/** Clears the stored answer so the banner asks again. Used by the footer link. */
export function resetConsent(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
