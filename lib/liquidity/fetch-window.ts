/** Transaction window of the Liquidità tabs: from 1 January of the previous year to 31 December, so changing period does not refetch. */
export function liquidityFetchWindow(referenceDate: Date): { from: string; to: string } {
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: key(new Date(referenceDate.getFullYear() - 1, 0, 1)), to: key(new Date(referenceDate.getFullYear(), 11, 31)) };
}
