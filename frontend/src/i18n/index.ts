/**
 * i18n/index.ts
 *
 * The app's words in the user's language (UC-X03). English is the source
 * and the fallback: a phrase a catalogue lacks is shown in English, never as
 * a key. Money, dates and emergency numbers follow the market, not the
 * language (utils/region.ts). The choice is kept on the phone and on the
 * account, so what the backend sends this person uses it too.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';

import en from './locales/en.json';
import sn from './locales/sn.json';
import nd from './locales/nd.json';
import { FALLBACK_LANGUAGE, pickLanguage, type LanguageCode } from './languages';

export const LANGUAGE_KEY = '@siham_language';

function phoneLanguages(): string[] {
  try {
    return getLocales().map(l => l.languageTag);
  } catch {
    return [];
  }
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, sn: { translation: sn }, nd: { translation: nd } },
  lng: pickLanguage(null, phoneLanguages()),
  fallbackLng: FALLBACK_LANGUAGE,
  // React escapes already; a translation must never show as raw "{{number}}"
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** Applies the language saved on this phone, if any; called once at start-up */
export async function restoreLanguage(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
    const language = pickLanguage(saved, phoneLanguages());
    if (language !== i18n.language) await i18n.changeLanguage(language);
  } catch {
    // Keep the phone's language
  }
}

/** Switches the app at once and remembers the choice on this phone */
export async function changeLanguage(language: LanguageCode): Promise<void> {
  await i18n.changeLanguage(language);
  await AsyncStorage.setItem(LANGUAGE_KEY, language).catch(() => undefined);
}

/** English words, for lines that must also be understood by English readers (SOS texts) */
export const english = i18n.getFixedT(FALLBACK_LANGUAGE);

export default i18n;
