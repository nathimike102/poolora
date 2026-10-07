/**
 * i18n/languages.ts
 *
 * The languages Siham can be shown in (UC-X03). A language is offered only
 * once native speakers have reviewed its catalogue, safety screens first: a
 * wrong word on the SOS screen could cost someone help. Builds for the
 * translators set EXPO_PUBLIC_SHOW_UNREVIEWED_LANGUAGES=true to see the rest.
 */

import { REGION } from '../utils/region';

export type LanguageCode = 'en' | 'sn' | 'nd';

export interface Language {
  code: LanguageCode;
  /** The language's name in English */
  name: string;
  /** The language's name in itself, as shown in the picker */
  nativeName: string;
  /** Native speakers have checked the whole catalogue */
  reviewed: boolean;
}

export const LANGUAGES: Record<LanguageCode, Language> = {
  en: { code: 'en', name: 'English', nativeName: 'English', reviewed: true },
  sn: { code: 'sn', name: 'Shona', nativeName: 'chiShona', reviewed: false },
  nd: { code: 'nd', name: 'Ndebele', nativeName: 'isiNdebele', reviewed: false },
};

export const FALLBACK_LANGUAGE: LanguageCode = 'en';

export const isLanguageCode = (code: unknown): code is LanguageCode =>
  typeof code === 'string' && code in LANGUAGES;

/** The languages this build offers: the market's, reviewed ones only unless translators are testing */
export function offeredLanguages(showUnreviewed = process.env.EXPO_PUBLIC_SHOW_UNREVIEWED_LANGUAGES === 'true'): Language[] {
  return REGION.languages
    .filter(isLanguageCode)
    .map(code => LANGUAGES[code])
    .filter(l => l.reviewed || showUnreviewed);
}

/**
 * The language to start in: the user's saved choice if still offered, else
 * the first of the phone's languages that is offered, else English.
 */
export function pickLanguage(saved: string | null | undefined, phoneLanguages: string[], offered = offeredLanguages()): LanguageCode {
  const codes = offered.map(l => l.code);
  if (isLanguageCode(saved) && codes.includes(saved)) return saved;
  const fromPhone = phoneLanguages.map(tag => tag.toLowerCase().split(/[-_]/)[0]).find(isLanguageCode);
  if (fromPhone && codes.includes(fromPhone)) return fromPhone;
  return FALLBACK_LANGUAGE;
}
