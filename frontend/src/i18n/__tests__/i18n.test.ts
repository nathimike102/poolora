/** Set by Jest for each test file */
declare const __dirname: string;

import i18n from '..';
import en from '../locales/en.json';
import { offeredLanguages, pickLanguage, LANGUAGES } from '../languages';
import { sosMessage } from '../../screens/shared/SOSScreen';

describe('which languages are offered', () => {
  it('offers only reviewed languages, unless translators are testing', () => {
    expect(offeredLanguages(false).map(l => l.code)).toEqual(['en']);
    expect(offeredLanguages(true).map(l => l.code)).toEqual(['en', 'sn', 'nd']);
  });

  it('starts in the saved choice, else the phone\'s language, else English', () => {
    const all = Object.values(LANGUAGES);
    expect(pickLanguage('nd', ['en-GB'], all)).toBe('nd');
    expect(pickLanguage(null, ['fr-FR', 'sn-ZW'], all)).toBe('sn');
    expect(pickLanguage(null, ['fr-FR'], all)).toBe('en');
    // A saved language that is no longer offered falls back
    expect(pickLanguage('sn', ['sn-ZW'], offeredLanguages(false))).toBe('en');
  });
});

describe('words', () => {
  afterEach(async () => {
    i18n.removeResourceBundle('sn', 'translation');
    i18n.addResourceBundle('sn', 'translation', {});
    await i18n.changeLanguage('en');
  });

  it('shows English for a phrase a catalogue lacks, never the key', async () => {
    // A phrase only the English catalogue has, as when a new one is not yet translated
    i18n.addResource('en', 'translation', 'test.onlyInEnglish', 'Only in English');
    await i18n.changeLanguage('sn');
    expect(i18n.t('test.onlyInEnglish')).toBe('Only in English');
  });

  it('fills in numbers without escaping them', () => {
    expect(i18n.t('sos.callEmergency', { number: '999' })).toBe('Call 999');
  });

  it('sends the SOS text in English, with the location', () => {
    expect(sosMessage({ lat: -17.8, lng: 31.05 }, 'en')).toBe(
      'SOS. I need help during a Siham ride. I am here: https://maps.google.com/?q=-17.8,31.05',
    );
    expect(sosMessage(null, 'en')).toBe('SOS. I need help during a Siham ride.');
  });

  it('adds the English beneath an SOS text in another language', () => {
    i18n.addResourceBundle('sn', 'translation', { sos: { smsBody: '[sn] SOS body' } }, true, true);
    expect(sosMessage(null, 'sn')).toBe('[sn] SOS body\n\nSOS. I need help during a Siham ride.');
  });
});

describe('the English catalogue', () => {
  // Every key the code asks for exists, so no screen ever shows a raw key
  it('has every key used in the app', () => {
    const fs = jest.requireActual<{
      readdirSync(dir: string, options: { withFileTypes: true }): Array<{ name: string; isDirectory(): boolean }>;
      readFileSync(file: string, encoding: 'utf8'): string;
    }>('fs');
    const path = jest.requireActual<{ join(...parts: string[]): string; basename(file: string): string }>('path');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { if (entry.name !== '__tests__') walk(full); }
        else if (/\.tsx?$/.test(entry.name)) files.push(full);
      }
    };
    walk(path.join(__dirname, '..', '..'));
    const has = (key: string) => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], en) !== undefined;
    const missing: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      for (const match of source.matchAll(/\b(?:i18n\.)?t\('([a-zA-Z0-9_.]+)'/g)) {
        if (!has(match[1])) missing.push(`${path.basename(file)}: ${match[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
