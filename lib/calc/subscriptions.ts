/**
 * Subscription detection from transactions: a pure, deterministic and explainable engine (no AI).
 *
 * A series of charges becomes a subscription candidate when it has the same merchant (`subscriptionKey`, which reads
 * through the codes, card numbers and dates banks append and recognises known brands however they are spelled), gaps
 * that fit one cadence (weekly … yearly, with slack for weekends and bank delays), a stable day of the month, and a
 * constant amount (or a few clean price changes). Spending that recurs but changes every time (groceries, metered
 * bills) does NOT pass. When one merchant bills several subscriptions (Apple, Google, Amazon) the series is split by
 * amount, and a split series that stopped is followed into the merchant's later charges before calling it stopped.
 */

import { merchantKey } from "@/lib/categorization/merchant-key";
import { extractMerchantName } from "@/lib/categorization/merchant-name/extract";
import { GENERIC_ALIAS_NAMES } from "@/lib/categorization/merchant-name/aliases";

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
/** Addebiti minimi di un gruppo di importo uguale, quando l'esercente ne ha anche altri diversi. */
const MIN_CLUSTER_SIZE = 3;
/** Altri addebiti ammessi (diversi dal gruppo) per ogni addebito del gruppo, più un margine fisso. */
const OTHER_CHARGES_PER_CLUSTERED_CHARGE = 5;
const OTHER_CHARGES_SLACK = 2;
/** Largest amount difference between two charges of one merchant to put them in the same amount cluster (very tight: a subscription is charged to the cent, a shopping basket is not). */
const CLUSTER_TOLERANCE = 0.01;
/** A change beyond this ratio is not a price change but another expense. */
const PRICE_STEP_RANGE = [0.5, 2] as const;
/** Price changes accepted in one series (a promo, its end, a yearly rise); every price but the last needs two charges. */
const MAX_PRICE_STEPS = 3;
/** Charges of another amount cluster inside a series' dates that make it a parallel subscription, not its continuation. */
const PARALLEL_CHARGES = 2;
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
  /**
   * Other keys the same series was saved under: keys of earlier versions of the detection (one per bank spelling) and
   * of an earlier price or a stopped series this one replaced. A saved choice under one of them still applies.
   */
  aliases: string[];
  /** Series continued across charges of another amount (price change, plan change) or replacing a stopped one. */
  continued: boolean;
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

/**
 * Key of the previous detection (before 2026-10-26): `merchantKey` without the tokens that contain digits. Choices saved
 * then are stored under it, so detection still lists it among a series' `aliases`.
 */
export function legacySubscriptionKey(description: string): string {
  const base = merchantKey(description);
  const stable = base
    .split(" ")
    .filter((token) => token.length > 0 && !/\d/.test(token))
    .join(" ");
  return stable.length > 0 ? stable : base;
}

/** Card and booking-date tail banks append to card payments («Carta N. ***** 249 Data operazione 01/02/26»). */
const CARD_TAIL = /\b(?:carta|card)\s+n(?:r|um)?\b.*$|\bdata\s+(?:operazione|op|valuta)\b.*$/i;
/** A web domain in the description (`anthropic.com`, `apple.com/bill`): the label before the extension names the merchant. */
const DOMAIN = /\b([a-z0-9][a-z0-9-]*[a-z][a-z0-9-]*)\.(?:com|net|org|io|ai|app|tv|co|eu|it|de|fr|es|ie|uk|nl|ch|at|be)\b/g;
/** Domains of payment processors and generic hosts: they say who collected the money, not who sold the service. */
const PROCESSOR_DOMAINS: ReadonlySet<string> = new Set(["www", "paypal", "pp", "stripe", "paddle", "sumup", "satispay"]);
/** Two-letter country codes and single letters left at the end of a bank text after the codes are gone. */
const SHORT_TOKEN = /^[a-z]{1,2}$/;

/** Last merchant domain label in the description, or null. */
function domainLabel(description: string): string | null {
  const text = description.toLowerCase();
  let label: string | null = null;
  for (const match of text.matchAll(DOMAIN)) if (!PROCESSOR_DOMAINS.has(match[1])) label = match[1];
  return label;
}

/**
 * Merchant key of a charge, the same for every spelling of one merchant: a known brand of the merchant dictionary
 * (`APPLE.COM/BILL 800915904 IE` and `Apple.com/bill` → `apple`, `CLAUDE.AI SUBSCRIPTION` and `Anthropic Claude Sub` →
 * `claude`), otherwise the website in the text (`foo.com`), otherwise the words of the text without codes, card number,
 * booking date, country code and single letters. Generic dictionary entries (cash withdrawal, stamp duty…) never key.
 */
export function subscriptionKey(description: string): string {
  const { name, source } = extractMerchantName({ rawText: description });
  if (source === "alias" && !GENERIC_ALIAS_NAMES.has(name)) return merchantKey(name);
  const domain = domainLabel(description);
  if (domain) return domain;
  const words = legacySubscriptionKey(description.replace(CARD_TAIL, " ")).split(" ");
  const meaningful = words.filter((word) => !SHORT_TOKEN.test(word));
  return meaningful.length > 0 ? meaningful.join(" ") : legacySubscriptionKey(description);
}

/** Name shown for a series: the brand when the dictionary knows it, else the bank text of the last charge. */
function displayName(description: string): string {
  const { name, source } = extractMerchantName({ rawText: description });
  return source === "alias" && !GENERIC_ALIAS_NAMES.has(name) ? name : description;
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

/**
 * Stable amount? Yes if constant, or if it moves in a few clean price changes (runs of a constant price, each but the
 * last with at least two charges, each change between 0.5x and 2x); otherwise `null`. `step` is the latest change.
 */
function analyseAmounts(amounts: readonly number[], tolerance: number) {
  if (spread(amounts) <= tolerance) return { mode: "costante" as const, step: null };
  const runs: number[][] = [];
  for (const amount of amounts) {
    const current = runs[runs.length - 1];
    if (current && spread([...current, amount]) <= tolerance) current.push(amount);
    else runs.push([amount]);
  }
  if (runs.length - 1 > MAX_PRICE_STEPS || runs.slice(0, -1).some((run) => run.length < 2)) return null;
  for (let i = 1; i < runs.length; i++) {
    const ratio = median(runs[i]) / median(runs[i - 1]);
    if (ratio < PRICE_STEP_RANGE[0] || ratio > PRICE_STEP_RANGE[1]) return null;
  }
  const last = runs[runs.length - 1];
  return { mode: "costante" as const, step: { cut: amounts.length - last.length, from: median(runs[runs.length - 2]), to: median(last) } };
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
    aliases: [],
    continued: false,
    name: displayName(last.description),
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

const byDate = (a: SubscriptionTxInput, b: SubscriptionTxInput) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
const clusterKeyOf = (key: string, cluster: readonly SubscriptionTxInput[]) => `${key}#${median(cluster.map((tx) => tx.amount)).toFixed(2)}`;

/**
 * Keys a choice on this series may have been saved under: the previous detection's key of each bank spelling (alone,
 * and per amount cluster as it split a merchant), and the per-amount keys of this merchant. Latest spelling first.
 */
function aliasesOf(key: string, merchantKeyOf: string, series: readonly SubscriptionTxInput[]): string[] {
  const keys: string[] = [];
  const bySpelling = new Map<string, SubscriptionTxInput[]>();
  for (const tx of [...series].reverse()) {
    const legacy = legacySubscriptionKey(tx.description);
    const list = bySpelling.get(legacy);
    if (list) list.push(tx);
    else bySpelling.set(legacy, [tx]);
  }
  for (const [legacy, charges] of bySpelling) {
    keys.push(legacy);
    for (const cluster of clusterByAmount(charges)) keys.push(clusterKeyOf(legacy, cluster));
  }
  keys.push(merchantKeyOf);
  for (const cluster of clusterByAmount(series)) keys.push(clusterKeyOf(merchantKeyOf, cluster));
  return [...new Set(keys)].filter((alias) => alias !== key);
}

/**
 * Follows a stopped series into the merchant's later charges: each next charge must fall in the cadence window (or one
 * period later) and be within a price change of the previous one; charges of a cluster that ran alongside the series
 * are another subscription and are never taken. Returns the continued candidate, or null when nothing fits.
 */
function continueSeries(
  candidate: DetectedSubscription,
  series: readonly SubscriptionTxInput[],
  pool: readonly SubscriptionTxInput[],
  parallel: ReadonlySet<string>,
  today: string
): DetectedSubscription | null {
  const rule = CADENCE_RULES[candidate.cadence];
  const chain = [...series];
  const taken = new Set(chain.map((tx) => tx.id));
  for (;;) {
    const last = chain[chain.length - 1];
    const fits = (tx: SubscriptionTxInput, factor: number) => {
      const gap = toDay(tx.date) - toDay(last.date);
      const ratio = tx.amount / last.amount;
      return gap >= rule.window[0] * factor - (factor - 1) * 2 && gap <= rule.window[1] * factor + (factor - 1) * 2 && ratio >= PRICE_STEP_RANGE[0] && ratio <= PRICE_STEP_RANGE[1];
    };
    const options = pool.filter((tx) => !taken.has(tx.id) && !parallel.has(tx.id) && tx.date > last.date);
    const direct = options.filter((tx) => fits(tx, 1));
    const next = (direct.length > 0 ? direct : options.filter((tx) => fits(tx, 2))).sort(
      (a, b) => Math.abs(Math.log(a.amount / last.amount)) - Math.abs(Math.log(b.amount / last.amount)) || byDate(a, b)
    )[0];
    if (!next) break;
    chain.push(next);
    taken.add(next.id);
  }
  if (chain.length === series.length) return null;
  const continued = buildCandidate(candidate.key, chain, candidate.cadence, today);
  return continued ? { ...continued, continued: true } : null;
}

/**
 * Finds the subscriptions within one merchant's charges (`key`, sorted by date): the whole series if it holds,
 * otherwise one per amount cluster, oldest first, each followed across price changes when it looks stopped.
 */
function detectForMerchant(key: string, series: readonly SubscriptionTxInput[], today: string): DetectedSubscription[] {
  const whole = bestCandidate(key, series, today);
  if (whole) return [{ ...whole, aliases: aliasesOf(key, key, series) }];

  const clusters = clusterByAmount(series).sort((a, b) => byDate(a[0], b[0]));
  const candidates: DetectedSubscription[] = [];
  const used = new Set<string>();
  for (const cluster of clusters) {
    const free = cluster.filter((tx) => !used.has(tx.id));
    // Un esercente frequentato di continuo (supermercato) può avere per caso tre scontrini uguali: non basta.
    if (free.length < MIN_CLUSTER_SIZE || series.length - free.length > OTHER_CHARGES_PER_CLUSTERED_CHARGE * free.length + OTHER_CHARGES_SLACK) continue;
    let candidate = bestCandidate(clusterKeyOf(key, free), free, today);
    if (!candidate) continue;
    let charges = free;
    if (candidate.state === "fermo") {
      const first = free[0].date;
      const last = free[free.length - 1].date;
      const parallel = new Set<string>();
      for (const other of clusters) {
        if (other === cluster) continue;
        if (other.filter((tx) => tx.date >= first && tx.date <= last).length >= PARALLEL_CHARGES) for (const tx of other) parallel.add(tx.id);
      }
      const pool = series.filter((tx) => !used.has(tx.id));
      const continued = continueSeries(candidate, free, pool, parallel, today);
      if (continued) {
        candidate = continued;
        const ids = new Set(continued.charges.map((charge) => charge.id));
        charges = series.filter((tx) => ids.has(tx.id));
      }
    }
    for (const tx of charges) used.add(tx.id);
    candidates.push({ ...candidate, aliases: aliasesOf(candidate.key, key, charges) });
  }

  // A stopped series followed later by an active one of the same merchant at a nearby price (a plan changed after a
  // pause) is the same subscription: the stopped one is not listed, and its keys move to the one that replaced it.
  const replaced = new Set<DetectedSubscription>();
  for (const stopped of candidates) {
    if (stopped.state !== "fermo") continue;
    const successor = candidates.find((other) => {
      if (other.state !== "attivo" || other.charges[0].date <= stopped.lastDate) return false;
      const ratio = other.charges[0].amount / stopped.amount;
      return ratio >= PRICE_STEP_RANGE[0] && ratio <= PRICE_STEP_RANGE[1];
    });
    if (!successor) continue;
    successor.aliases = [...new Set([...successor.aliases, stopped.key, ...stopped.aliases])].filter((alias) => alias !== successor.key);
    successor.continued = true;
    replaced.add(stopped);
  }
  return candidates.filter((candidate) => !replaced.has(candidate));
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
    found.push(...detectForMerchant(key, [...group].sort(byDate), today));
  }
  return found.filter((c) => c.confidence >= MIN_CONFIDENCE).sort((a, b) => (a.nextDate < b.nextDate ? -1 : 1));
}
