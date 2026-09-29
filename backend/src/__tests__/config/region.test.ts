import { fromLocalClock, localTime, money, toE164, toLocalClock } from '../../config/region';

it('reads Zimbabwe mobile numbers however they are typed', () => {
  expect(toE164('0771 234 567')).toBe('+263771234567');
  expect(toE164('+263-71-234-5678')).toBe('+263712345678');
  expect(toE164('0242123456')).toBeNull(); // a Harare landline
  expect(toE164('+919876543210')).toBeNull();
});

it('writes money in US dollars or ZiG', () => {
  expect(money(5)).toBe('US$5');
  expect(money(5.5)).toBe('US$5.50');
  expect(money(79.5, 'ZWG')).toBe('ZiG 79.50');
});

it('works in Zimbabwe time, two hours ahead of UTC all year', () => {
  const utc = new Date('2026-06-30T23:30:00Z');
  expect(toLocalClock(utc).toISOString()).toBe('2026-07-01T01:30:00.000Z');
  expect(fromLocalClock(toLocalClock(utc)).getTime()).toBe(utc.getTime());
  expect(localTime(utc, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })).toBe('1 Jul, 01:30');
});
