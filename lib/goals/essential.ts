import { addMonths, effectiveAmount, isExpense, parseDateOnly, startOfMonth } from "@/lib/calc/expenses";
import { categoryGroupKey } from "@/lib/categories/groups";
import type { Category } from "@/lib/db/schema/categories";
import type { Transaction } from "@/lib/db/schema/transactions";

/** Gruppi che contano come spese da coprire con il fondo di emergenza: quelle dovute e le saltuarie inevitabili. */
const ESSENTIAL_GROUPS = new Set(["dovuta", "saltuaria"]);
/** Oltre questa quota di spesa senza categoria le spese dovute non sono affidabili: si usano tutte le spese. */
const MAX_UNCATEGORIZED_SHARE = 0.25;
/** Mesi guardati all'indietro. */
const ESSENTIAL_LOOKBACK_MONTHS = 12;

/** Spese del mese su cui si propone il fondo di emergenza, e da dove vengono. */
export interface EssentialSpending {
  monthly: number;
  /** `dovute` = solo i gruppi Dovute e Saltuarie; `tutte` = tutte le uscite (troppe senza categoria). */
  basis: "dovute" | "tutte";
  /** Mesi su cui si è fatta la media. */
  months: number;
}

/**
 * Media mensile delle spese da coprire con un fondo di emergenza, dai movimenti degli ultimi 12 mesi: si parte dal primo
 * mese con uscite e il mese in corso conta solo se è l'unico. A differenza del piano delle Analitiche non chiede un
 * minimo di mesi né guarda le ipotesi: è solo il punto di partenza di una cifra che l'utente può cambiare.
 * Null se non ci sono uscite.
 */
export function essentialSpendingFrom(input: { transactions: Transaction[]; categories: Category[]; today: Date }): EssentialSpending | null {
  const byId = new Map(input.categories.map((c) => [c.id, c]));
  const thisMonth = startOfMonth(input.today);
  const from = addMonths(thisMonth, -ESSENTIAL_LOOKBACK_MONTHS);
  let total = 0;
  let essential = 0;
  let uncategorized = 0;
  let pastTotal = 0;
  let pastEssential = 0;
  let pastUncategorized = 0;
  let first: Date | null = null;
  for (const t of input.transactions) {
    if (!isExpense(t)) continue;
    const date = parseDateOnly(t.date);
    if (date < from || date > input.today) continue;
    const category = t.categoryId ? byId.get(t.categoryId) : undefined;
    const group = category ? categoryGroupKey(category) : "daCategorizzare";
    // Entrate e trasferimenti tra conti non sono spese.
    if (group === null) continue;
    const amount = Math.abs(effectiveAmount(t));
    if (amount === 0) continue;
    const isEssential = ESSENTIAL_GROUPS.has(group);
    const isUncategorized = group === "daCategorizzare";
    total += amount;
    if (isEssential) essential += amount;
    if (isUncategorized) uncategorized += amount;
    if (date < thisMonth) {
      pastTotal += amount;
      if (isEssential) pastEssential += amount;
      if (isUncategorized) pastUncategorized += amount;
      const month = startOfMonth(date);
      if (first === null || month < first) first = month;
    }
  }
  if (total === 0) return null;
  // Con almeno un mese chiuso il mese in corso (a metà) resta fuori; altrimenti c'è solo quello.
  const usePast = first !== null;
  const months = usePast ? monthsBetween(first as Date, thisMonth) : 1;
  const sum = usePast ? pastTotal : total;
  const ess = usePast ? pastEssential : essential;
  const unc = usePast ? pastUncategorized : uncategorized;
  const reliable = unc / sum <= MAX_UNCATEGORIZED_SHARE && ess > 0;
  return { monthly: (reliable ? ess : sum) / months, basis: reliable ? "dovute" : "tutte", months };
}

/** Mesi interi da `from` (primo del mese) a `to` (primo del mese), escluso `to`. */
function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}
