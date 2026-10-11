/**
 * Rilevamento degli abbonamenti dalle transazioni: motore puro, deterministico e spiegabile (nessuna AI).
 *
 * Una serie di addebiti diventa un candidato abbonamento se: stesso esercente (`subscriptionKey`), distanza tra
 * un addebito e il successivo compatibile con una cadenza (settimanale … annuale, con tolleranza per weekend e
 * ritardi della banca), giorno del mese stabile, importo costante (o con un solo cambio di prezzo netto).
 * Una spesa che torna spesso ma varia ogni volta (supermercato, bolletta a consumo) NON passa.
 * Quando un esercente fattura più abbonamenti (Apple, Google, Amazon) la serie si separa per importo.
 */

import { merchantKey } from "@/lib/categorization/merchant-key";

export const SUBSCRIPTION_CADENCES = ["settimanale", "mensile", "trimestrale", "semestrale", "annuale"] as const;
export type SubscriptionCadence = (typeof SUBSCRIPTION_CADENCES)[number];

interface CadenceRule {
  /** Distanza accettata (giorni) tra due addebiti consecutivi. */
  window: readonly [number, number];
  /** Addebiti minimi per proporre l'abbonamento. */
  minOccurrences: number;
  /** Variazione massima dell'importo, (max−min)/mediana, per considerarlo costante. */
  amountSpread: number;
  /** Mesi tra due addebiti (0 per la cadenza settimanale, che va a giorni). */
  months: number;
  /** Giorni di tolleranza oltre la data attesa prima di dire che l'addebito è saltato. */
  graceDays: number;
  /** Addebiti in un mese (per il costo mensile equivalente). */
  perMonth: number;
}

export const CADENCE_RULES: Record<SubscriptionCadence, CadenceRule> = {
  settimanale: { window: [6, 8], minOccurrences: 5, amountSpread: 0.08, months: 0, graceDays: 3, perMonth: 52 / 12 },
  mensile: { window: [27, 34], minOccurrences: 3, amountSpread: 0.08, months: 1, graceDays: 7, perMonth: 1 },
  trimestrale: { window: [86, 96], minOccurrences: 3, amountSpread: 0.15, months: 3, graceDays: 14, perMonth: 1 / 3 },
  semestrale: { window: [174, 190], minOccurrences: 3, amountSpread: 0.25, months: 6, graceDays: 21, perMonth: 1 / 6 },
  annuale: { window: [355, 376], minOccurrences: 2, amountSpread: 0.25, months: 12, graceDays: 30, perMonth: 1 / 12 },
};

/** Etichette italiane delle cadenze ("ogni mese"). */
export const CADENCE_LABELS: Record<SubscriptionCadence, string> = {
  settimanale: "ogni settimana",
  mensile: "ogni mese",
  trimestrale: "ogni 3 mesi",
  semestrale: "ogni 6 mesi",
  annuale: "ogni anno",
};

/** Finestra di storico letta per il rilevamento: due addebiti annuali stanno entro 26 mesi. */
export const SUBSCRIPTION_LOOKBACK_MONTHS = 26;
/** Oltre questa distanza dall'ultimo addebito, un abbonamento non confermato non viene più proposto. */
const MAX_SILENT_DAYS = 400;
/** Distanza massima (giorni) dal giorno tipico del mese perché l'addebito conti come "puntuale". */
const DAY_OF_MONTH_TOLERANCE = 5;
/** Sotto questa affidabilità un candidato non viene proposto. */
export const MIN_CONFIDENCE = 0.6;
/** Differenza massima di importo tra due addebiti dello stesso esercente per metterli nello stesso abbonamento (strettissima: un abbonamento si addebita al centesimo, un cestino della spesa no). */
/** Addebiti minimi di un gruppo di importo uguale, quando l'esercente ne ha anche altri diversi. */
const MIN_CLUSTER_SIZE = 3;
/** Altri addebiti ammessi (diversi dal gruppo) per ogni addebito del gruppo, più un margine fisso. */
const OTHER_CHARGES_PER_CLUSTERED_CHARGE = 5;
const OTHER_CHARGES_SLACK = 2;
const CLUSTER_TOLERANCE = 0.01;
/** Un aumento oltre questo rapporto non è un cambio di prezzo ma un'altra spesa. */
const PRICE_STEP_RANGE = [0.5, 2] as const;
const DAY_MS = 86_400_000;

export interface SubscriptionTxInput {
  id: string;
  /** Data ISO `YYYY-MM-DD`. */
  date: string;
  /** Importo in valore assoluto (una spesa). */
  amount: number;
  description: string;
  categoryId: string | null;
}

export interface SubscriptionCharge {
  id: string;
  date: string;
  amount: number;
}

/** Perché il rilevamento ha proposto l'abbonamento: ogni voce diventa una frase nella scheda dettaglio. */
export type SubscriptionReason =
  | { kind: "count"; count: number }
  | { kind: "cadence"; cadence: SubscriptionCadence; skipped: boolean }
  | { kind: "amount"; mode: "costante" | "variabile-lieve" }
  | { kind: "price-change"; from: number; to: number; since: string }
  | { kind: "day"; day: number };

export interface DetectedSubscription {
  /** Chiave stabile (esercente, più l'importo se l'esercente ne fattura più d'uno): ci si appoggiano le scelte dell'utente. */
  key: string;
  name: string;
  cadence: SubscriptionCadence;
  /** Importo dell'ultimo addebito (prezzo attuale). */
  amount: number;
  charges: SubscriptionCharge[];
  lastDate: string;
  /** Prossimo addebito atteso. */
  nextDate: string;
  /** Cambio di prezzo netto trovato nella serie. */
  priceChange: { from: number; to: number; since: string } | null;
  /** `fermo`: l'addebito atteso è saltato oltre la tolleranza (terminato o dimenticato?). */
  state: "attivo" | "fermo";
  /** Giorni di ritardo rispetto alla data attesa (0 se non ancora scaduta). */
  overdueDays: number;
  categoryId: string | null;
  confidence: number;
  reasons: SubscriptionReason[];
}

/** Chiave dell'esercente: come `merchantKey`, ma senza i token con cifre (codici, riferimenti, date) che cambiano a ogni addebito. */
export function subscriptionKey(description: string): string {
  const base = merchantKey(description);
  const stable = base
    .split(" ")
    .filter((token) => token.length > 0 && !/\d/.test(token))
    .join(" ");
  return stable.length > 0 ? stable : base;
}

const toDay = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY_MS;
const fromDay = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);
const median = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const spread = (values: readonly number[]) => {
  const m = median(values);
  return m === 0 ? 0 : (Math.max(...values) - Math.min(...values)) / m;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Aggiunge `months` mesi a una data ISO tenendo il giorno richiesto (con il limite di fine mese). */
export function addMonthsIso(iso: string, months: number, day = +iso.slice(8, 10)): string {
  const y = +iso.slice(0, 4);
  const m = +iso.slice(5, 7) - 1 + months;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, last))).toISOString().slice(0, 10);
}

/** Data del prossimo addebito dopo `lastDate`, tenendo il giorno tipico del mese. */
export function nextChargeDate(lastDate: string, cadence: SubscriptionCadence, day = +lastDate.slice(8, 10)): string {
  const rule = CADENCE_RULES[cadence];
  return rule.months === 0 ? fromDay(toDay(lastDate) + 7) : addMonthsIso(lastDate, rule.months, day);
}

/** Costo mensile equivalente di un importo con la sua cadenza. */
export function monthlyEquivalent(amount: number, cadence: SubscriptionCadence): number {
  return round2(amount * CADENCE_RULES[cadence].perMonth);
}

/** Importo stabile? Sì se costante, o se c'è un solo cambio di prezzo netto; altrimenti `null`. */
function analyseAmounts(amounts: readonly number[], tolerance: number) {
  if (spread(amounts) <= tolerance) return { mode: "costante" as const, step: null };
  // Un solo gradino: cerco l'ultimo punto di taglio con due tratti costanti, il primo di almeno 2 addebiti.
  for (let cut = amounts.length - 1; cut >= 2; cut--) {
    const before = amounts.slice(0, cut);
    const after = amounts.slice(cut);
    if (spread(before) > tolerance || spread(after) > tolerance) continue;
    const ratio = median(after) / median(before);
    if (ratio < PRICE_STEP_RANGE[0] || ratio > PRICE_STEP_RANGE[1]) continue;
    return { mode: "costante" as const, step: { cut, from: median(before), to: median(after) } };
  }
  return null;
}

/** Valuta se una serie (ordinata per data) è un abbonamento con la cadenza data; `null` se no. */
function evaluateSeries(series: readonly SubscriptionTxInput[], cadence: SubscriptionCadence) {
  const rule = CADENCE_RULES[cadence];
  if (series.length < rule.minOccurrences) return null;
  const days = series.map((tx) => toDay(tx.date));
  let regular = 0;
  let skipped = 0;
  for (let i = 1; i < days.length; i++) {
    const gap = days[i] - days[i - 1];
    if (gap >= rule.window[0] && gap <= rule.window[1]) regular += 1;
    else if (gap >= rule.window[0] * 2 - 2 && gap <= rule.window[1] * 2 + 2) skipped += 1;
    else return null;
  }
  // Un addebito saltato (banca non sincronizzata, pagamento fallito) si perdona una volta sola.
  if (skipped > 1 || regular < 1 || (cadence !== "annuale" && regular < 2)) return null;
  if (rule.months >= 1) {
    const dayOfMonth = series.map((tx) => (+tx.date.slice(8, 10) >= 28 ? 29 : +tx.date.slice(8, 10)));
    const typical = median(dayOfMonth);
    if (dayOfMonth.some((d) => Math.abs(d - typical) > DAY_OF_MONTH_TOLERANCE && 30 - Math.abs(d - typical) > DAY_OF_MONTH_TOLERANCE)) return null;
  }
  const amounts = analyseAmounts(series.map((tx) => tx.amount), rule.amountSpread);
  if (!amounts) return null;
  return { regular, skipped, amounts };
}

function buildCandidate(key: string, series: readonly SubscriptionTxInput[], cadence: SubscriptionCadence, today: string): DetectedSubscription | null {
  const evaluation = evaluateSeries(series, cadence);
  if (!evaluation) return null;
  const rule = CADENCE_RULES[cadence];
  const last = series[series.length - 1];
  const dayOfMonth = round2(median(series.map((tx) => +tx.date.slice(8, 10))));
  const typicalDay = Math.round(dayOfMonth);
  const nextDate = nextChargeDate(last.date, cadence, rule.months >= 1 ? typicalDay : undefined);
  const overdueDays = Math.max(0, Math.round(toDay(today) - toDay(nextDate)));
  const silentDays = toDay(today) - toDay(last.date);
  if (silentDays > MAX_SILENT_DAYS) return null;

  const step = evaluation.amounts.step;
  const priceChange = step ? { from: round2(step.from), to: round2(step.to), since: series[step.cut].date } : null;
  const reasons: SubscriptionReason[] = [
    { kind: "count", count: series.length },
    { kind: "cadence", cadence, skipped: evaluation.skipped > 0 },
    priceChange ? { kind: "price-change", ...priceChange } : { kind: "amount", mode: spread(series.map((tx) => tx.amount)) === 0 ? "costante" : "variabile-lieve" },
  ];
  if (rule.months >= 1 && cadence === "mensile") reasons.push({ kind: "day", day: typicalDay });

  const exact = spread(series.map((tx) => tx.amount)) === 0;
  const confidence = Math.min(1, 0.45 + 0.07 * Math.min(series.length, 6) + (exact ? 0.15 : 0.05) + (evaluation.skipped === 0 ? 0.1 : 0) - (priceChange ? 0.05 : 0));
  return {
    key,
    name: last.description,
    cadence,
    amount: round2(last.amount),
    charges: series.map((tx) => ({ id: tx.id, date: tx.date, amount: round2(tx.amount) })),
    lastDate: last.date,
    nextDate,
    priceChange,
    state: overdueDays > rule.graceDays ? "fermo" : "attivo",
    overdueDays,
    categoryId: last.categoryId,
    confidence: round2(confidence),
    reasons,
  };
}

/** Prova ogni cadenza sulla serie; la prima che regge (la più frequente) vince. */
function bestCandidate(key: string, series: readonly SubscriptionTxInput[], today: string): DetectedSubscription | null {
  for (const cadence of SUBSCRIPTION_CADENCES) {
    const candidate = buildCandidate(key, series, cadence, today);
    if (candidate) return candidate;
  }
  return null;
}

/** Separa gli addebiti di un esercente in gruppi di importo simile (più abbonamenti sullo stesso esercente). */
function clusterByAmount(series: readonly SubscriptionTxInput[]): SubscriptionTxInput[][] {
  const sorted = [...series].sort((a, b) => a.amount - b.amount);
  const clusters: SubscriptionTxInput[][] = [];
  for (const tx of sorted) {
    const current = clusters[clusters.length - 1];
    if (current && tx.amount <= median(current.map((t) => t.amount)) * (1 + CLUSTER_TOLERANCE)) current.push(tx);
    else clusters.push([tx]);
  }
  return clusters.map((cluster) => cluster.sort((a, b) => (a.date < b.date ? -1 : 1)));
}

/**
 * Trova gli abbonamenti nelle spese. `transactions` sono le uscite (importi positivi) degli ultimi
 * `SUBSCRIPTION_LOOKBACK_MONTHS` mesi; `today` è la data ISO di oggi. Ordine: prossimo addebito più vicino per primo.
 */
export function detectSubscriptions(transactions: readonly SubscriptionTxInput[], today: string): DetectedSubscription[] {
  const groups = new Map<string, SubscriptionTxInput[]>();
  for (const tx of transactions) {
    if (tx.amount <= 0) continue;
    const key = subscriptionKey(tx.description);
    if (key.length === 0) continue;
    const group = groups.get(key);
    if (group) group.push(tx);
    else groups.set(key, [tx]);
  }

  const found: DetectedSubscription[] = [];
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const series = [...group].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const whole = bestCandidate(key, series, today);
    if (whole) {
      found.push(whole);
      continue;
    }
    for (const cluster of clusterByAmount(series)) {
      // Un esercente frequentato di continuo (supermercato) può avere per caso tre scontrini uguali: non basta.
      if (cluster.length < MIN_CLUSTER_SIZE || series.length - cluster.length > OTHER_CHARGES_PER_CLUSTERED_CHARGE * cluster.length + OTHER_CHARGES_SLACK) continue;
      const clusterKey = `${key}#${median(cluster.map((tx) => tx.amount)).toFixed(2)}`;
      const candidate = bestCandidate(clusterKey, cluster, today);
      if (candidate) found.push(candidate);
    }
  }
  return found.filter((c) => c.confidence >= MIN_CONFIDENCE).sort((a, b) => (a.nextDate < b.nextDate ? -1 : 1));
}
