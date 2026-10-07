/**
 * Matches a message by how it reads in English, whether the code passed
 * plain text or a catalogue phrase (UC-X03).
 */
import { render, type Phrase } from '../../i18n';

export function inEnglish(expected: string, { contains = false } = {}) {
  return {
    asymmetricMatch: (actual: string | Phrase) => {
      const text = render('en', actual);
      return contains ? text.includes(expected) : text === expected;
    },
    toString: () => `inEnglish(${JSON.stringify(expected)})`,
    toAsymmetricMatcher: () => `inEnglish(${JSON.stringify(expected)})`,
  };
}
