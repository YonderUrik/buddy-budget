const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

/** "febbraio 2027" da una data ISO. */
export function formatMonthYear(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number);
  return `${MONTHS[month - 1]} ${year}`;
}

/** "4 anni e 5 mesi", "1 anno", "7 mesi": una durata in mesi, a parole. */
export function formatDuration(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [years > 0 ? `${years} ${years === 1 ? "anno" : "anni"}` : "", rest > 0 ? `${rest} ${rest === 1 ? "mese" : "mesi"}` : ""].filter(Boolean);
  return parts.length > 0 ? parts.join(" e ") : "0 mesi";
}
