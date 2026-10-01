/** Data di oggi (UTC) come `YYYY-MM-DD`: serve sia al server sia al client, per questo vive fuori da `events.ts`. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
