import { WHATS_NEW_MAX_AGE_DAYS, type WhatsNewEntry } from "./entries";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The news item to show: the latest not dismissed and not too old; `null` if none. With `since` (the user's sign-up),
 * items released before it are skipped: a feature that existed when the user arrived is not news to them.
 */
export function pickWhatsNew(entries: readonly WhatsNewEntry[], dismissedIds: readonly string[], now: Date, since?: Date): WhatsNewEntry | null {
  const dismissed = new Set(dismissedIds);
  const sinceKey = since ? since.toISOString().slice(0, 10) : null;
  const fresh = entries
    .filter((entry) => !dismissed.has(entry.id))
    .filter((entry) => sinceKey === null || entry.date > sinceKey)
    .filter((entry) => (now.getTime() - new Date(`${entry.date}T00:00:00Z`).getTime()) / DAY_MS <= WHATS_NEW_MAX_AGE_DAYS)
    .sort((a, b) => b.date.localeCompare(a.date));
  return fresh[0] ?? null;
}
