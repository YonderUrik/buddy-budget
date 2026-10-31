import type { Outcome } from "./contract";

/** A file row as the confirm step sees it: its line key, what the parser read and the rate to the user's currency. */
export type MatchRecord = { key: string; outcome: Outcome; rate: number | null };
/** A movement already in the account, or an operation already in the portfolio, reduced to its exact content. */
export type ExistingCash = { date: string; amount: string; description: string };
export type ExistingTrade = { date: string; type: string; isin: string | null; name: string; quantity: string; price: string; grossAmount: string | null };

const norm = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");
const tradeKey = (date: string, type: string, identity: string, quantity: number, price: number, gross: number | null) =>
  `i|${date}|${type}|${identity}|${quantity.toFixed(8)}|${price.toFixed(6)}|${gross === null ? "" : gross.toFixed(2)}`;

/** Exact content of a file row in the user's currency (cents as stored), or null for rows that import nothing. */
export function contentKey(record: MatchRecord): string | null {
  const o = record.outcome;
  if (o.kind === "cash") return record.rate ? `c|${o.date}|${Math.round(o.amount * record.rate * 100)}|${norm(o.description)}` : null;
  if (o.kind === "investment") return tradeKey(o.date, o.type, norm(o.isin ?? o.name), o.quantity, o.price, o.grossAmount);
  return null;
}
export function existingCashKey(row: ExistingCash) { return `c|${row.date}|${Math.round(Number(row.amount) * 100)}|${norm(row.description)}`; }
export function existingTradeKey(row: ExistingTrade) {
  return tradeKey(row.date, row.type, norm(row.isin ?? row.name), Number(row.quantity), Number(row.price), row.grossAmount === null ? null : Number(row.grossAmount));
}

/**
 * Keys of `candidates` (rows with a new line key) whose exact content is already stored: the same movement exported
 * again after the bank changed its layout. Counted as a multiset: a stored row covers one file row, and rows of the
 * file already matched by line key use up their stored copy first, so two identical coffees on one day stay two.
 */
export function presentByContent(file: MatchRecord[], candidates: MatchRecord[], stored: string[]): Set<string> {
  const available = new Map<string, number>();
  for (const key of stored) available.set(key, (available.get(key) ?? 0) + 1);
  const candidateKeys = new Set(candidates.map(r => r.key));
  for (const record of file) {
    if (candidateKeys.has(record.key)) continue;
    const key = contentKey(record);
    if (key && available.has(key)) available.set(key, available.get(key)! - 1);
  }
  const present = new Set<string>();
  for (const record of candidates) {
    const key = contentKey(record);
    if (!key || (available.get(key) ?? 0) <= 0) continue;
    available.set(key, available.get(key)! - 1);
    present.add(record.key);
  }
  return present;
}
