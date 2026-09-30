import { easterSunday, holidaysIn, isHolidayDate } from '../../utils/holidays';
import { MARKETS } from '../../config/region';

const zw = MARKETS.ZW.holidays;

describe('public holidays', () => {
  it('finds Easter Sunday', () => {
    expect(easterSunday(2026)).toEqual([4, 5]);
    expect(easterSunday(2027)).toEqual([3, 28]);
    expect(easterSunday(2025)).toEqual([4, 20]);
  });

  it("puts Heroes' and Defence Forces Days on the second Monday and Tuesday of August", () => {
    const days = holidaysIn(2026, zw);
    expect(days).toContainEqual({ date: '2026-08-10', name: "Heroes' Day" });
    expect(days).toContainEqual({ date: '2026-08-11', name: 'Defence Forces Day' });
  });

  it('moves the Easter weekend with Easter', () => {
    const dates = holidaysIn(2026, zw).map((h) => h.date);
    expect(dates).toEqual(expect.arrayContaining(['2026-04-03', '2026-04-04', '2026-04-06']));
  });

  it('keeps a Sunday holiday on the Monday after', () => {
    // Independence Day 2027 is a Sunday
    expect(isHolidayDate('2027-04-18', zw)).toBe(true);
    expect(isHolidayDate('2027-04-19', zw)).toBe(true);
  });

  it('moves Christmas on a Sunday to the Tuesday, after Boxing Day', () => {
    // 25 December 2022 was a Sunday
    const dec = holidaysIn(2022, zw).filter((h) => h.date.startsWith('2022-12-2'));
    expect(dec.map((h) => h.date)).toEqual(['2022-12-22', '2022-12-25', '2022-12-26', '2022-12-27']);
  });

  it('treats ordinary days as working days', () => {
    expect(isHolidayDate('2026-09-30', zw)).toBe(false);
  });
});
