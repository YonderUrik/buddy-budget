import { convertAmount, type FxTable } from "@/lib/calc/fx";
import {
  QUANTITY_EPSILON,
  sortTransactions,
  type InstrumentInput,
  type InvestmentTransactionInput,
  type PositionRow,
} from "@/lib/calc/investments";
import type { TaxInstrument } from "@/lib/calc/taxes";
import type { CouponFrequency } from "@/lib/db/schema/investments";
import type { InstrumentSettingInput } from "./tax-settings";

/**
 * Proventi: dividendi e cedole da registrare, previsione dei prossimi 12 mesi, incassi mese per mese e per strumento
 * (vedi spec 2026-09-30-investimenti-fase-4-design.md, sezione 4). Funzioni pure; importi in valuta utente salvo dove
 * indicato.
 */

/** Stacco di un dividendo dalla fonte: importo per quota nella valuta dello strumento, già corretto per gli split. */
export interface DividendEventInput {
  instrumentId: string;
  exDate: string;
  amount: string;
}

/** Proposta ignorata dall'utente. */
export interface DismissedIncomeInput {
  instrumentId: string;
  date: string;
}

/** Un dividendo registrato "copre" uno stacco se è tra 5 giorni prima e 60 giorni dopo (il pagamento segue lo stacco). */
export const MATCH_DAYS_BEFORE = 5;
export const MATCH_DAYS_AFTER = 60;
/** Mesi della previsione. */
export const FORECAST_MONTHS = 12;
/** Anni solari completi guardati per la crescita del dividendo. */
export const GROWTH_YEARS = 5;

const INCOME_TYPES = new Set(["dividendo", "cedola"]);

function shiftDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Sposta una data di `months` mesi, fermandosi all'ultimo giorno del mese se serve (31 gen + 1 → 28/29 feb). */
export function shiftMonths(dateKey: string, months: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(day, lastDay));
  return first.toISOString().slice(0, 10);
}

function endOfMonth(dateKey: string): string {
  const [year, month] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/** Quote di uno strumento nel tempo: quante se ne possedevano prima di una data, e il fattore degli split successivi. */
interface QuantityTimeline {
  /** Quote alla chiusura del giorno prima di `dateKey` (operazioni con data < `dateKey`). */
  before(dateKey: string): number;
  /** Quote alla fine di `dateKey` inclusa. */
  at(dateKey: string): number;
  /** Prodotto dei rapporti degli split con data ≥ `dateKey` (per portare quote vecchie alle quote di oggi). */
  splitsFrom(dateKey: string): number;
  firstBuy: string | null;
}

function buildTimeline(transactions: InvestmentTransactionInput[]): QuantityTimeline {
  const sorted = sortTransactions(transactions);
  const quantityWhile = (include: (date: string) => boolean) => {
    let quantity = 0;
    for (const t of sorted) {
      if (!include(t.date)) break;
      const q = Number(t.quantity);
      if (t.type === "acquisto") quantity += q;
      else if (t.type === "vendita" || t.type === "rimborso") quantity = Math.max(0, quantity - q);
      else if (t.type === "split" && q > 0) quantity *= q;
    }
    return quantity < QUANTITY_EPSILON ? 0 : quantity;
  };
  return {
    before: (dateKey) => quantityWhile((d) => d < dateKey),
    at: (dateKey) => quantityWhile((d) => d <= dateKey),
    splitsFrom: (dateKey) =>
      sorted.filter((t) => t.type === "split" && t.date >= dateKey && Number(t.quantity) > 0).reduce((f, t) => f * Number(t.quantity), 1),
    firstBuy: sorted.find((t) => t.type === "acquisto")?.date ?? null,
  };
}

/** Termini delle cedole di un'obbligazione inseriti dall'utente, o null se incompleti. */
export interface CouponTerms {
  /** Tasso annuo lordo (0,035 = 3,5%). */
  rate: number;
  frequency: CouponFrequency;
  maturityDate: string;
}

export function couponTermsOf(setting: InstrumentSettingInput | undefined): CouponTerms | null {
  if (!setting?.couponRate || !setting.couponFrequency || !setting.maturityDate) return null;
  const rate = Number(setting.couponRate);
  return rate > 0 ? { rate, frequency: setting.couponFrequency, maturityDate: setting.maturityDate } : null;
}

/** Date di stacco delle cedole in (`fromKey`, `toKey`], calcolate a ritroso dalla scadenza. */
export function couponDates(terms: CouponTerms, fromKey: string, toKey: string): string[] {
  const step = 12 / terms.frequency;
  const dates: string[] = [];
  for (let i = 0; i < 12 * 100; i += step) {
    const date = shiftMonths(terms.maturityDate, -i);
    if (date <= fromKey) break;
    if (date <= toKey) dates.push(date);
  }
  return dates.reverse();
}

/** Input comune dei calcoli sui proventi. */
export interface IncomeInput {
  transactions: InvestmentTransactionInput[];
  instruments: InstrumentInput[];
  taxInstruments: TaxInstrument[];
  settings: InstrumentSettingInput[];
  dividends: DividendEventInput[];
  fx: FxTable;
  userCurrency: string;
  todayKey: string;
}

interface InstrumentContext {
  instrument: InstrumentInput;
  taxRate: number;
  timeline: QuantityTimeline;
  events: { exDate: string; amount: number }[];
  terms: CouponTerms | null;
  income: InvestmentTransactionInput[];
}

function contexts(input: IncomeInput): InstrumentContext[] {
  const taxById = new Map(input.taxInstruments.map((i) => [i.id, i]));
  const settingsById = new Map(input.settings.map((s) => [s.instrumentId, s]));
  return input.instruments.map((instrument) => {
    const own = input.transactions.filter((t) => t.instrumentId === instrument.id);
    return {
      instrument,
      taxRate: taxById.get(instrument.id)?.taxRate ?? 0.26,
      timeline: buildTimeline(own),
      events: input.dividends
        .filter((d) => d.instrumentId === instrument.id)
        .map((d) => ({ exDate: d.exDate, amount: Number(d.amount) }))
        .filter((d) => d.amount > 0)
        .sort((a, b) => a.exDate.localeCompare(b.exDate)),
      // Le cedole si calcolano sul nominale: solo per le obbligazioni quotate in % del nominale.
      terms: instrument.type === "obbligazione" && instrument.priceUnit === "percentuale_nominale" ? couponTermsOf(settingsById.get(instrument.id)) : null,
      income: own.filter((t) => INCOME_TYPES.has(t.type)),
    };
  });
}

/** Provento che l'utente probabilmente ha ricevuto ma non ha registrato. */
export interface MissingIncome {
  instrumentId: string;
  kind: "dividendo" | "cedola";
  /** Data di stacco (dividendi) o di cedola. */
  date: string;
  /** Quote (o nominale) possedute in quel momento, nelle unità di allora. */
  quantity: number;
  /** Lordo nella valuta dello strumento. */
  gross: number;
  /** Cambio valuta strumento → utente alla data, null se manca. */
  fxRate: number | null;
  /** Ritenuta italiana stimata, in valuta utente (null senza cambio). */
  estimatedTax: number | null;
}

/**
 * Dividendi (dagli stacchi della fonte) e cedole (dai termini inseriti) delle date in cui l'utente possedeva lo
 * strumento, senza un provento registrato vicino e non ignorati. Dal più recente.
 */
export function findMissingIncome(input: IncomeInput, dismissed: DismissedIncomeInput[]): MissingIncome[] {
  const dismissedKeys = new Set(dismissed.map((d) => `${d.instrumentId}|${d.date}`));
  const result: MissingIncome[] = [];
  for (const ctx of contexts(input)) {
    const { instrument, timeline } = ctx;
    if (!timeline.firstBuy) continue;
    const candidates: { date: string; kind: MissingIncome["kind"]; quantity: number; gross: number }[] = [];
    if (ctx.terms) {
      const to = ctx.terms.maturityDate < input.todayKey ? ctx.terms.maturityDate : input.todayKey;
      for (const date of couponDates(ctx.terms, timeline.firstBuy, to)) {
        const nominal = timeline.before(date);
        if (nominal > QUANTITY_EPSILON) {
          candidates.push({ date, kind: "cedola", quantity: nominal, gross: (nominal * ctx.terms.rate) / ctx.terms.frequency });
        }
      }
    } else {
      for (const event of ctx.events) {
        if (event.exDate <= timeline.firstBuy || event.exDate > input.todayKey) continue;
        const quantity = timeline.before(event.exDate);
        if (quantity <= QUANTITY_EPSILON) continue;
        // L'importo della fonte è per quota di oggi: le quote di allora si portano alle quote di oggi con gli split.
        candidates.push({ date: event.exDate, kind: "dividendo", quantity, gross: quantity * timeline.splitsFrom(event.exDate) * event.amount });
      }
    }
    const registered = [...ctx.income].sort((a, b) => a.date.localeCompare(b.date));
    const used = new Set<string>();
    for (const candidate of candidates) {
      const from = shiftDays(candidate.date, -MATCH_DAYS_BEFORE);
      const to = shiftDays(candidate.date, MATCH_DAYS_AFTER);
      const match = registered.find((t) => !used.has(t.id) && t.date >= from && t.date <= to);
      if (match) {
        used.add(match.id);
        continue;
      }
      if (dismissedKeys.has(`${instrument.id}|${candidate.date}`)) continue;
      const fxRate = convertAmount(input.fx, 1, instrument.currency, input.userCurrency, candidate.date);
      result.push({
        instrumentId: instrument.id,
        kind: candidate.kind,
        date: candidate.date,
        quantity: candidate.quantity,
        gross: candidate.gross,
        fxRate,
        estimatedTax: fxRate === null ? null : candidate.gross * fxRate * ctx.taxRate,
      });
    }
  }
  return result.sort((a, b) => b.date.localeCompare(a.date));
}

/** Provento previsto. `rimborso` è il capitale restituito a scadenza: si mostra, ma non è un provento. */
export interface ProjectedIncome {
  instrumentId: string;
  kind: "dividendo" | "cedola" | "rimborso";
  date: string;
  gross: number;
  net: number;
  /** `fonte`: stacchi dell'ultimo anno; `cedola`: dai termini inseriti; `storico`: dai tuoi incassi registrati. */
  basis: "fonte" | "cedola" | "storico";
}

export interface ForecastMonth {
  /** `YYYY-MM`. */
  key: string;
  gross: number;
  net: number;
}

export interface IncomeForecast {
  /** Dal mese prossimo, `FORECAST_MONTHS` mesi. */
  months: ForecastMonth[];
  /** In ordine di data, rimborsi compresi. */
  events: ProjectedIncome[];
  totalGross: number;
  totalNet: number;
  /** Strumenti posseduti per cui non si prevede niente perché mancano i dati (es. obbligazioni senza cedole inserite). */
  bondsWithoutTerms: string[];
}

/**
 * Proventi dei prossimi 12 mesi solari interi (dal mese prossimo), con le quote di oggi: cedole e rimborsi dai
 * termini delle obbligazioni; dividendi dagli stacchi dello stesso periodo di un anno prima; senza stacchi dalla
 * fonte, dai proventi registrati in quel periodo riproporzionati alle quote di oggi. Netto = lordo al netto
 * dell'aliquota italiana (ritenute estere escluse).
 */
export function forecastIncome(input: IncomeInput): IncomeForecast {
  const { todayKey } = input;
  const windowStart = endOfMonth(todayKey);
  const windowEnd = endOfMonth(shiftMonths(`${todayKey.slice(0, 7)}-01`, FORECAST_MONTHS));
  const events: ProjectedIncome[] = [];
  const bondsWithoutTerms: string[] = [];

  for (const ctx of contexts(input)) {
    const { instrument, timeline } = ctx;
    const quantity = timeline.at(todayKey);
    if (quantity <= QUANTITY_EPSILON) continue;
    const toUser = (amount: number) => convertAmount(input.fx, amount, instrument.currency, input.userCurrency, todayKey);
    const push = (kind: ProjectedIncome["kind"], date: string, localGross: number, basis: ProjectedIncome["basis"]) => {
      const gross = toUser(localGross);
      if (gross === null || !(gross > 0)) return;
      events.push({ instrumentId: instrument.id, kind, date, gross, net: kind === "rimborso" ? gross : gross * (1 - ctx.taxRate), basis });
    };

    if (ctx.terms) {
      for (const date of couponDates(ctx.terms, windowStart, windowEnd)) {
        if (date <= ctx.terms.maturityDate) push("cedola", date, (quantity * ctx.terms.rate) / ctx.terms.frequency, "cedola");
      }
      if (ctx.terms.maturityDate > windowStart && ctx.terms.maturityDate <= windowEnd) {
        // Rimborso alla pari: il nominale.
        push("rimborso", ctx.terms.maturityDate, quantity, "cedola");
      }
      continue;
    }
    const sourceFrom = endOfMonth(shiftMonths(`${windowStart.slice(0, 7)}-01`, -12));
    const sourceTo = endOfMonth(shiftMonths(`${windowEnd.slice(0, 7)}-01`, -12));
    if (ctx.events.length > 0) {
      for (const event of ctx.events) {
        if (event.exDate > sourceFrom && event.exDate <= sourceTo) {
          push("dividendo", shiftMonths(event.exDate, 12), quantity * event.amount, "fonte");
        }
      }
      continue;
    }
    if (instrument.type === "obbligazione" && ctx.income.length === 0) bondsWithoutTerms.push(instrument.id);
    for (const t of ctx.income) {
      if (t.date <= sourceFrom || t.date > sourceTo) continue;
      const then = timeline.at(t.date) * timeline.splitsFrom(shiftDays(t.date, 1));
      const scale = then > QUANTITY_EPSILON ? quantity / then : 1;
      push(t.type === "cedola" ? "cedola" : "dividendo", shiftMonths(t.date, 12), Number(t.grossAmount ?? 0) * scale, "storico");
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date));
  const months: ForecastMonth[] = [];
  for (let i = 0; i < FORECAST_MONTHS; i += 1) {
    const key = shiftMonths(`${todayKey.slice(0, 7)}-01`, i + 1).slice(0, 7);
    const inMonth = events.filter((e) => e.kind !== "rimborso" && e.date.startsWith(key));
    months.push({ key, gross: inMonth.reduce((s, e) => s + e.gross, 0), net: inMonth.reduce((s, e) => s + e.net, 0) });
  }
  return {
    months,
    events,
    totalGross: months.reduce((s, m) => s + m.gross, 0),
    totalNet: months.reduce((s, m) => s + m.net, 0),
    bondsWithoutTerms,
  };
}

/** Incassi registrati di un mese. */
export interface IncomeMonth {
  month: number;
  gross: number;
  /** Ritenute e commissioni registrate. */
  withheld: number;
  net: number;
}

export interface IncomeYearDetail {
  year: number;
  months: IncomeMonth[];
  gross: number;
  withheld: number;
  net: number;
}

/** Dividendi e cedole registrati mese per mese, dall'anno più recente. Lordo = lordo × cambio dell'operazione. */
export function incomeByMonth(transactions: InvestmentTransactionInput[], todayKey: string): IncomeYearDetail[] {
  const years = new Map<number, IncomeYearDetail>();
  for (const t of transactions) {
    if (!INCOME_TYPES.has(t.type) || t.date > todayKey) continue;
    const year = Number(t.date.slice(0, 4));
    const detail =
      years.get(year) ??
      ({ year, months: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, gross: 0, withheld: 0, net: 0 })), gross: 0, withheld: 0, net: 0 } as IncomeYearDetail);
    const gross = Number(t.grossAmount ?? 0) * (Number(t.fxRate) || 1);
    const withheld = (Number(t.taxes) || 0) + (Number(t.fees) || 0);
    const month = detail.months[Number(t.date.slice(5, 7)) - 1];
    month.gross += gross;
    month.withheld += withheld;
    month.net += gross - withheld;
    detail.gross += gross;
    detail.withheld += withheld;
    detail.net += gross - withheld;
    years.set(year, detail);
  }
  return [...years.values()].sort((a, b) => b.year - a.year);
}

/** Crescita annua composta del dividendo per quota sugli ultimi anni solari completi, o null. */
export function dividendGrowth(events: { exDate: string; amount: number }[], currentYear: number): { rate: number; years: number } | null {
  const lastYear = currentYear - 1;
  const byYear = new Map<number, number>();
  for (const e of events) {
    const y = Number(e.exDate.slice(0, 4));
    if (y <= lastYear && y > lastYear - GROWTH_YEARS) byYear.set(y, (byYear.get(y) ?? 0) + e.amount);
  }
  const last = byYear.get(lastYear) ?? 0;
  const paidYears = [...byYear.entries()].filter(([, v]) => v > 0).map(([y]) => y);
  if (last <= 0 || paidYears.length < 2) return null;
  const firstYear = Math.min(...paidYears);
  const span = lastYear - firstYear;
  return span > 0 ? { rate: (last / byYear.get(firstYear)!) ** (1 / span) - 1, years: span } : null;
}

/** Proventi di una posizione. */
export interface IncomeInstrumentRow {
  instrumentId: string;
  /** Netto registrato negli ultimi 12 mesi. */
  trailingNet: number;
  /** Netto degli ultimi 12 mesi sul costo di carico attuale. */
  yieldOnCost: number | null;
  /** Lordo previsto nei prossimi 12 mesi. */
  forecastGross: number;
  /** Lordo previsto sul valore di oggi. */
  currentYield: number | null;
  growth: { rate: number; years: number } | null;
  /** Obbligazione con i termini delle cedole inseriti. */
  hasCouponTerms: boolean;
}

/**
 * Per ogni strumento posseduto o con proventi negli ultimi 12 mesi: incassato, rendimento sul costo e attuale,
 * crescita del dividendo. Dal più redditizio.
 */
export function incomeByInstrument(
  input: IncomeInput,
  rows: Pick<PositionRow, "instrument" | "costBasis" | "value">[],
  forecast: IncomeForecast
): IncomeInstrumentRow[] {
  const trailingFrom = shiftMonths(input.todayKey, -12);
  const rowsById = new Map(rows.map((r) => [r.instrument.id, r]));
  const result: IncomeInstrumentRow[] = [];
  for (const ctx of contexts(input)) {
    const id = ctx.instrument.id;
    const row = rowsById.get(id);
    const trailingNet = ctx.income
      .filter((t) => t.date > trailingFrom && t.date <= input.todayKey)
      .reduce((s, t) => s + Number(t.grossAmount ?? 0) * (Number(t.fxRate) || 1) - (Number(t.taxes) || 0) - (Number(t.fees) || 0), 0);
    const forecastGross = forecast.events.filter((e) => e.instrumentId === id && e.kind !== "rimborso").reduce((s, e) => s + e.gross, 0);
    const hasPayments = ctx.income.some((t) => t.date <= input.todayKey);
    const pays = hasPayments || trailingNet > 0 || forecastGross > 0 || ctx.events.length > 0 || ctx.terms !== null || ctx.instrument.type === "obbligazione";
    if (!row && !hasPayments) continue;
    if (!pays) continue;
    result.push({
      instrumentId: id,
      trailingNet,
      yieldOnCost: row && row.costBasis > 0 ? trailingNet / row.costBasis : null,
      forecastGross,
      currentYield: row?.value && row.value > 0 ? forecastGross / row.value : null,
      growth: dividendGrowth(ctx.events, Number(input.todayKey.slice(0, 4))),
      hasCouponTerms: ctx.terms !== null,
    });
  }
  return result.sort((a, b) => b.forecastGross - a.forecastGross || b.trailingNet - a.trailingNet);
}
