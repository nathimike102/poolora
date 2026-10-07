import { formatKg, formatKm, monthLabel, petrolLitres } from '../carbon';

describe('carbon wording', () => {
  it('shows small savings to a tenth of a kg, larger ones whole, and tonnes from 1,000 kg', () => {
    expect(formatKg(0.85)).toBe('0.9 kg');
    expect(formatKg(42.4)).toBe('42 kg');
    expect(formatKg(1250)).toBe('1.25 tonnes');
  });

  it('shows distances the same way', () => {
    expect(formatKm(7.66)).toBe('7.7 km');
    expect(formatKm(1240)).toBe('1,240 km');
  });

  it('turns a saving into litres of petrol', () => {
    expect(petrolLitres(23.1)).toBe(10);
    expect(petrolLitres(0.5)).toBe(0);
  });

  it('names the month', () => {
    expect(monthLabel('2026-03')).toBe('Mar');
  });
});
