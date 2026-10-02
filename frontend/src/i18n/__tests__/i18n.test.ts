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
    await i18n.changeLanguage('sn');
    expect(i18n.t('sos.active.title')).toBe(en.sos.active.title);
  });

  it('fills in numbers without escaping them', () => {
    expect(i18n.t('sos.callEmergency', { number: '999' })).toBe('Call 999');
  });

  it('sends the SOS text in English, with the location', () => {
    expect(sosMessage({ lat: -17.8, lng: 31.05 }, 'en')).toBe(
      'SOS. I need help during a Poolora ride. I am here: https://maps.google.com/?q=-17.8,31.05',
    );
    expect(sosMessage(null, 'en')).toBe('SOS. I need help during a Poolora ride.');
  });

  it('adds the English beneath an SOS text in another language', () => {
    i18n.addResourceBundle('sn', 'translation', { sos: { smsBody: '[sn] SOS body' } }, true, true);
    expect(sosMessage(null, 'sn')).toBe('[sn] SOS body\n\nSOS. I need help during a Poolora ride.');
  });
});
