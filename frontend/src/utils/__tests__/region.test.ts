import { formatPhone, money, moneyInput, nationalDigits, toE164 } from '../region';

describe('region helpers', () => {
  it('reads Zimbabwe mobile numbers however they are typed', () => {
    expect(toE164('0771 234 567')).toBe('+263771234567');
    expect(toE164('+263 71 234 5678')).toBe('+263712345678');
    expect(toE164('263733123456')).toBe('+263733123456');
    expect(toE164('771234567')).toBe('+263771234567');
    expect(toE164('0242 123 456')).toBeNull(); // a Harare landline
    expect(toE164('98765 43210')).toBeNull();
    expect(nationalDigits('0771 234 567')).toBe('771234567');
    expect(formatPhone('+263771234567')).toBe('+263 77 123 4567');
  });

  it('writes money in US dollars or ZiG, with cents only when there are some', () => {
    expect(money(12)).toBe('US$12');
    expect(money(12.5)).toBe('US$12.50');
    expect(money(1234.567)).toBe('US$1,234.57');
    expect(money(-3)).toBe('-US$3');
    expect(money(340.25, 'ZWG')).toBe('ZiG 340.25');
  });

  it('keeps money fields to digits and two decimals', () => {
    expect(moneyInput('12.345')).toBe('12.34');
    expect(moneyInput('$1,5.0.9')).toBe('15.09');
    expect(moneyInput('abc')).toBe('');
  });
});

describe('displayPhone', () => {
  const { displayPhone } = require('../phone');
  it('shows a Zimbabwe number in groups, and hides the Firebase placeholder', () => {
    expect(displayPhone('+263775550101')).toBe('+263 77 555 0101');
    expect(displayPhone('firebase:abc')).toBeUndefined();
    expect(displayPhone(undefined)).toBeUndefined();
  });
});
