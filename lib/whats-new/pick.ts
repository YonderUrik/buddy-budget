import { WHATS_NEW_MAX_AGE_DAYS, type WhatsNewEntry } from "./entries";

const DAY_MS = 24 * 60 * 60 * 1000;

/** La novità da mostrare: la più recente non ancora chiusa e non troppo vecchia; `null` se non ce n'è. */
export function pickWhatsNew(entries: readonly WhatsNewEntry[], dismissedIds: readonly string[], now: Date): WhatsNewEntry | null {
  const dismissed = new Set(dismissedIds);
  const fresh = entries
    .filter((entry) => !dismissed.has(entry.id))
    .filter((entry) => (now.getTime() - new Date(`${entry.date}T00:00:00Z`).getTime()) / DAY_MS <= WHATS_NEW_MAX_AGE_DAYS)
    .sort((a, b) => b.date.localeCompare(a.date));
  return fresh[0] ?? null;
}
