const ROME_TZ = "Europe/Rome";
const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface RomeDate {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
  /** 0 = domenica, 1 = lunedì */
  weekday: number;
  iso: string;
}

/** Data di oggi a Roma: le email parlano di "oggi" e "questo mese" come li vive l'utente, non in UTC. */
export function romeDate(now: Date): RomeDate {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: ROME_TZ, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  return { year, month, day, weekday: WEEKDAYS[parts.weekday], iso: `${parts.year}-${parts.month}-${parts.day}` };
}

/** Data locale (mezzanotte) del giorno di Roma: è quella che i motori di `lib/calc` si aspettano come data di riferimento. */
export function romeReferenceDate(now: Date): Date {
  const { year, month, day } = romeDate(now);
  return new Date(year, month - 1, day);
}
