/** Unisce gli abbonamenti rilevati con le scelte dell'utente e calcola totali, prossimi addebiti e aumenti: funzione pura. */

import {
  CADENCE_RULES,
  monthlyEquivalent,
  nextChargeDate,
  type DetectedSubscription,
  type SubscriptionCadence,
  type SubscriptionCharge,
  type SubscriptionReason,
} from "@/lib/calc/subscriptions";
import type { SubscriptionStatus } from "@/lib/db/schema/subscriptions";

/** Come lo vede l'utente: `da-confermare` è rilevato ma senza una sua scelta. */
export type SubscriptionDecision = "da-confermare" | SubscriptionStatus;

/** Giorni in avanti considerati "prossimi" (striscia dei prossimi addebiti). */
export const UPCOMING_WINDOW_DAYS = 30;
/** Un aumento di prezzo si segnala finché è successo da meno di questo. */
export const PRICE_RISE_WINDOW_DAYS = 365;

export interface StoredSubscriptionRow {
  id: string;
  key: string;
  status: SubscriptionStatus;
  origin: "rilevato" | "manuale";
  name: string | null;
  amount: number | null;
  cadence: SubscriptionCadence | null;
  nextDate: string | null;
  categoryId: string | null;
}

export interface SubscriptionItem {
  key: string;
  /** Id della scelta salvata; `null` finché l'utente non ha deciso nulla. */
  id: string | null;
  name: string;
  origin: "rilevato" | "manuale";
  decision: SubscriptionDecision;
  /** `fermo`: l'addebito atteso è saltato (terminato o dimenticato?). */
  activity: "attivo" | "fermo";
  cadence: SubscriptionCadence | null;
  amount: number | null;
  /** Costo mensile equivalente. */
  monthly: number | null;
  lastDate: string | null;
  nextDate: string | null;
  overdueDays: number;
  priceChange: { from: number; to: number; since: string } | null;
  charges: SubscriptionCharge[];
  reasons: SubscriptionReason[];
  confidence: number | null;
  categoryId: string | null;
}

export interface SubscriptionTotals {
  /** Abbonamenti confermati e attivi. */
  count: number;
  monthly: number;
  yearly: number;
  /** Rilevati ma ancora da confermare (non entrano nei totali sopra). */
  pendingCount: number;
  pendingMonthly: number;
}

export interface SubscriptionsView {
  items: SubscriptionItem[];
  totals: SubscriptionTotals;
}

const DAY_MS = 86_400_000;
const dayNumber = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY_MS;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Porta avanti la data di un abbonamento manuale finché non è futura (o entro la tolleranza di ritardo). */
function rollForward(date: string, cadence: SubscriptionCadence, today: string): string {
  let next = date;
  const grace = CADENCE_RULES[cadence].graceDays;
  for (let guard = 0; guard < 600 && dayNumber(today) - dayNumber(next) > grace; guard++) next = nextChargeDate(next, cadence);
  return next;
}

function fromDetected(detected: DetectedSubscription, row: StoredSubscriptionRow | undefined): SubscriptionItem {
  return {
    key: detected.key,
    id: row?.id ?? null,
    name: row?.name ?? detected.name,
    origin: row?.origin ?? "rilevato",
    decision: row?.status ?? "da-confermare",
    activity: detected.state,
    cadence: detected.cadence,
    amount: detected.amount,
    monthly: monthlyEquivalent(detected.amount, detected.cadence),
    lastDate: detected.lastDate,
    nextDate: detected.nextDate,
    overdueDays: detected.overdueDays,
    priceChange: detected.priceChange,
    charges: detected.charges,
    reasons: detected.reasons,
    confidence: detected.confidence,
    categoryId: row?.categoryId ?? detected.categoryId,
  };
}

function fromStoredOnly(row: StoredSubscriptionRow, today: string): SubscriptionItem {
  const manual = row.origin === "manuale";
  const cadence = row.cadence;
  const nextDate = manual && cadence && row.nextDate ? rollForward(row.nextDate, cadence, today) : null;
  return {
    key: row.key,
    id: row.id,
    name: row.name ?? row.key,
    origin: row.origin,
    decision: row.status,
    activity: manual ? "attivo" : "fermo",
    cadence,
    amount: row.amount,
    monthly: row.amount !== null && cadence ? monthlyEquivalent(row.amount, cadence) : null,
    lastDate: null,
    nextDate,
    overdueDays: 0,
    priceChange: null,
    charges: [],
    reasons: [],
    confidence: null,
    categoryId: row.categoryId,
  };
}

/** Costruisce la vista: rilevati + scelte salvate (+ manuali), con i totali dei soli abbonamenti confermati e attivi. */
export function buildSubscriptionsView(detected: readonly DetectedSubscription[], rows: readonly StoredSubscriptionRow[], today: string): SubscriptionsView {
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const items: SubscriptionItem[] = detected.map((d) => fromDetected(d, byKey.get(d.key)));
  const seen = new Set(detected.map((d) => d.key));
  for (const row of rows) if (!seen.has(row.key)) items.push(fromStoredOnly(row, today));

  items.sort((a, b) => (a.nextDate ?? "9999") < (b.nextDate ?? "9999") ? -1 : 1);
  const confirmed = items.filter((i) => i.decision === "confermato" && i.activity === "attivo" && i.monthly !== null);
  const pending = items.filter((i) => i.decision === "da-confermare" && i.activity === "attivo" && i.monthly !== null);
  const monthly = round2(confirmed.reduce((sum, i) => sum + (i.monthly ?? 0), 0));
  return {
    items,
    totals: {
      count: confirmed.length,
      monthly,
      yearly: round2(monthly * 12),
      pendingCount: pending.length,
      pendingMonthly: round2(pending.reduce((sum, i) => sum + (i.monthly ?? 0), 0)),
    },
  };
}

/** Abbonamenti confermati e attivi con addebito atteso entro `UPCOMING_WINDOW_DAYS` giorni (anche se in lieve ritardo). */
export function upcomingCharges(items: readonly SubscriptionItem[], today: string, windowDays = UPCOMING_WINDOW_DAYS): SubscriptionItem[] {
  return items.filter((i) => i.decision === "confermato" && i.activity === "attivo" && i.nextDate && dayNumber(i.nextDate) - dayNumber(today) <= windowDays);
}

/** Abbonamenti non esclusi con un aumento di prezzo recente. */
export function recentPriceRises(items: readonly SubscriptionItem[], today: string): SubscriptionItem[] {
  return items.filter(
    (i) => i.priceChange && i.priceChange.to > i.priceChange.from && i.decision !== "escluso" && i.decision !== "terminato" && dayNumber(today) - dayNumber(i.priceChange.since) <= PRICE_RISE_WINDOW_DAYS
  );
}
