/** Transaction window of the Liquidità tabs: from 1 January of the previous year to 31 December, so changing period does not refetch. */
export function liquidityFetchWindow(referenceDate: Date): { from: string; to: string } {
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: key(new Date(referenceDate.getFullYear() - 1, 0, 1)), to: key(new Date(referenceDate.getFullYear(), 11, 31)) };
}

/**
 * The newest year with movements before the start of the loaded window, or null when nothing older exists. Loading
 * from its 1 January also covers the empty years in between.
 */
export function previousYearWithMovements(years: number[], loadedFrom: string): number | null {
  const loadedYear = Number(loadedFrom.slice(0, 4));
  return years.filter((year) => year < loadedYear).sort((a, b) => b - a)[0] ?? null;
}
