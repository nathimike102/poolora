/**
 * holidays.ts
 *
 * Public holidays worked out from each market's rules, so moving holidays
 * (Easter, Zimbabwe's Heroes' Day) need no yearly update. The demand model
 * uses them: fewer people commute on a holiday.
 */

export type HolidayRule =
  /** The same date every year */
  | { name: string; month: number; day: number }
  /** Days after Easter Sunday; Good Friday is -2 */
  | { name: string; easterOffset: number }
  /** The nth weekday of a month (weekday 0 = Sunday), plus an optional day offset */
  | { name: string; month: number; weekday: number; nth: number; offsetDays?: number };

export interface HolidayCalendar {
  rules: HolidayRule[];
  /** A holiday falling on a Sunday is also kept on the Monday after */
  sundayMovesToMonday: boolean;
}

/** Easter Sunday in the Gregorian calendar (anonymous Gregorian algorithm), as [month, day] */
export function easterSunday(year: number): [number, number] {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return [month, day];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));

/** The holidays in a year, as YYYY-MM-DD dates with their names, in date order */
export function holidaysIn(year: number, calendar: HolidayCalendar): Array<{ date: string; name: string }> {
  const dated = calendar.rules.map((rule) => {
    if ('easterOffset' in rule) {
      const [month, day] = easterSunday(year);
      return { name: rule.name, date: utc(year, month, day + rule.easterOffset) };
    }
    if ('nth' in rule) {
      const first = utc(year, rule.month, 1);
      const shift = (rule.weekday - first.getUTCDay() + 7) % 7;
      return { name: rule.name, date: utc(year, rule.month, 1 + shift + (rule.nth - 1) * 7 + (rule.offsetDays ?? 0)) };
    }
    return { name: rule.name, date: utc(year, rule.month, rule.day) };
  });
  const out = new Map(dated.map((h) => [iso(h.date), h.name]));
  if (calendar.sundayMovesToMonday) {
    for (const h of dated.filter((d) => d.date.getUTCDay() === 0)) {
      // Christmas on a Sunday already has Boxing Day on the Monday; its day off moves to the Tuesday
      let observed = new Date(h.date.getTime() + 86_400_000);
      while (out.has(iso(observed))) observed = new Date(observed.getTime() + 86_400_000);
      out.set(iso(observed), `${h.name} (observed)`);
    }
  }
  return [...out].map(([date, name]) => ({ date, name })).sort((x, y) => x.date.localeCompare(y.date));
}

/** Whether a local calendar date (YYYY-MM-DD) is a public holiday */
export function isHolidayDate(localDate: string, calendar: HolidayCalendar): boolean {
  const year = Number(localDate.slice(0, 4));
  return holidaysIn(year, calendar).some((h) => h.date === localDate);
}
