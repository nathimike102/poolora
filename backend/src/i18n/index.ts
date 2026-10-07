/**
 * i18n/index.ts
 *
 * What the backend says to people, in their language (UC-X03). Pushes,
 * in-app notifications and texts name a phrase in the catalogue; each is
 * written in the recipient's language (User.language) when it is sent, and
 * any phrase a catalogue lacks is sent in English. The app's own words live
 * in frontend/src/i18n; this catalogue is only what the server writes.
 */

import { REGION } from '../config/region';
import en from './locales/en.json';
import sn from './locales/sn.json';
import nd from './locales/nd.json';

type Catalogue = { [key: string]: string | Catalogue };

const CATALOGUES: Record<string, Catalogue> = { en, sn, nd };
export const FALLBACK_LANGUAGE = 'en';

/** A catalogue phrase and the values it needs, sent in each recipient's language */
export interface Phrase {
  key: string;
  /** A value may itself be a phrase, written in the same language */
  vars?: Record<string, string | number | Phrase | Array<string | Phrase> | undefined>;
}

export const phrase = (key: string, vars?: Phrase['vars']): Phrase => ({ key, vars });

export const isPhrase = (value: unknown): value is Phrase =>
  typeof value === 'object' && value !== null && typeof (value as Phrase).key === 'string';

function lookup(catalogue: Catalogue | undefined, key: string): string | undefined {
  let node: string | Catalogue | undefined = catalogue;
  for (const part of key.split('.')) {
    if (!node || typeof node === 'string') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** A language this market offers, else English */
export function supportedLanguage(language?: string | null): string {
  return language && REGION.languages.includes(language) && CATALOGUES[language] ? language : FALLBACK_LANGUAGE;
}

/**
 * The phrase in this language, falling back to English, with {{name}} filled
 * in. A key missing from English too is returned as is, so it shows up in
 * review rather than as an empty message.
 */
export function translate(language: string | null | undefined, key: string, vars?: Phrase['vars']): string {
  const text = lookup(CATALOGUES[supportedLanguage(language)], key) ?? lookup(CATALOGUES[FALLBACK_LANGUAGE], key) ?? key;
  return text.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const value = vars?.[name];
    if (value === undefined || value === null) return '';
    // A list is written item by item and joined with commas
    if (Array.isArray(value)) return value.map((item) => render(language, item)).join(', ');
    return isPhrase(value) ? translate(language, value.key, value.vars) : String(value);
  });
}

/** Plain text stays as it is; a phrase is written in the language */
export function render(language: string | null | undefined, text: string | Phrase): string {
  return isPhrase(text) ? translate(language, text.key, text.vars) : text;
}

/**
 * The phrase in the language, with the English beneath when they differ:
 * for texts an English-only reader must still understand (SOS, UC-X03).
 */
export function withEnglish(language: string | null | undefined, text: string | Phrase): string {
  const local = render(language, text);
  const english = render(FALLBACK_LANGUAGE, text);
  return local === english ? local : `${local}\n\n${english}`;
}
