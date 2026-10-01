/** Data di oggi (UTC) come `YYYY-MM-DD`: serve sia al server sia al client, per questo vive fuori da `events.ts`. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Aggiunge (o toglie, con un numero negativo) giorni a una data ISO. */
export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
