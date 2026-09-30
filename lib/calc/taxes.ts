import type { InstrumentType, TaxRegime } from "@/lib/db/schema/investments";
import {
  priceMultiplier,
  QUANTITY_EPSILON,
  sortTransactions,
  type InstrumentInput,
  type InvestmentTransactionInput,
  type PortfolioDailyPoint,
} from "./investments";

/**
 * Stima della fiscalità italiana di un portafoglio (vedi spec 2026-09-30-investimenti-fase-4-design.md):
 * plus/minusvalenze col costo medio ponderato, zaino delle minusvalenze a 4 anni, redditi di capitale degli ETF,
 * crypto a parte, regime amministrato o dichiarativo, bollo. Stime per capire i numeri, non un calcolo certificato.
 */

/** Aliquota ordinaria: tutto si porta a "base al 26%" per compensare redditi con aliquote diverse. */
export const BASE_TAX_RATE = 0.26;
/** Aliquota dei titoli di Stato e assimilati. */
export const GOVERNMENT_BOND_TAX_RATE = 0.125;
/** Una minusvalenza dell'anno Y si usa fino al 31/12 di Y + 4. */
export const LOSS_CARRY_YEARS = 4;
/** Imposta di bollo annua sul valore del deposito titoli. */
export const BOLLO_RATE = 0.002;
/** Franchigia annua sulle plusvalenze nette delle crypto, in vigore fino al 2024. */
export const CRYPTO_EXEMPTION = 2000;
export const CRYPTO_EXEMPTION_LAST_YEAR = 2024;
/** Dal 2026 le plusvalenze crypto sono al 33% (Legge di Bilancio 2025). */
export const CRYPTO_HIGHER_RATE_FROM_YEAR = 2026;

/** Aliquota sulle plusvalenze crypto di un anno. */
export function cryptoTaxRate(year: number): number {
  return year >= CRYPTO_HIGHER_RATE_FROM_YEAR ? 0.33 : BASE_TAX_RATE;
}

/**
 * Categoria fiscale di una plus/minusvalenza: `diversi` (azioni, obbligazioni, ETC: compensabili con lo zaino),
 * `capitale` (guadagno di ETF/fondi: tassato per intero), `crypto` (a parte, sempre in dichiarazione).
 * La perdita di un ETF/fondo è comunque un reddito diverso: va nello zaino.
 */
export type TaxCategory = "diversi" | "capitale" | "crypto";

/** Strumento con le impostazioni fiscali già risolte (correzione dell'utente o automatico). */
export interface TaxInstrument extends InstrumentInput {
  /** 0,26 o 0,125. */
  taxRate: number;
  /** Solo ETF/fondi: false = non armonizzato (in realtà a IRPEF, qui stimato al 26%). */
  harmonized: boolean;
}

const FUND_TYPES: ReadonlySet<InstrumentType> = new Set(["etf", "fondo"]);

export function isFund(type: InstrumentType): boolean {
  return FUND_TYPES.has(type);
}

/** Categoria di una plus/minus dello strumento. */
export function taxCategoryOf(type: InstrumentType, gain: number): TaxCategory {
  if (type === "crypto") return "crypto";
  if (isFund(type) && gain > 0) return "capitale";
  return "diversi";
}

/** Importo portato a base 26%: una plus o minus al 12,5% vale il 48,08%. */
export function toBaseEquivalent(amount: number, rate: number): number {
  return (amount * rate) / BASE_TAX_RATE;
}

/** Plus o minusvalenza realizzata da una vendita o un rimborso. Importi in valuta utente. */
export interface RealizedGain {
  transactionId: string;
  instrumentId: string;
  date: string;
  year: number;
  quantity: number;
  /** Incasso al netto delle commissioni (le imposte trattenute non riducono la base imponibile). */
  proceeds: number;
  /** Costo medio ponderato delle quote vendute. */
  cost: number;
  gain: number;
  category: TaxCategory;
  /** Aliquota dello strumento (per le crypto quella dell'anno). */
  rate: number;
  /** Imposte trattenute registrate sull'operazione. */
  withheld: number;
  /** ETF/fondo non armonizzato: stima al 26%, in realtà IRPEF ordinaria. */
  nonHarmonized: boolean;
  /** Amministrato: zaino usato da questa plus (base 26%). Null nel dichiarativo e per le crypto. */
  lossesUsed: number | null;
  /** Amministrato: imposta stimata su questa operazione. Null nel dichiarativo e per le crypto. */
  estimatedTax: number | null;
}

const SELL_TYPES = new Set(["vendita", "rimborso"]);

function yearOf(dateKey: string): number {
  return Number(dateKey.slice(0, 4));
}

/**
 * Plus e minusvalenze di tutte le vendite e i rimborsi fino a `toKey` inclusa, col costo medio ponderato
 * (commissioni di acquisto incluse nel costo, di vendita dedotte dall'incasso). Lo split cambia le quote, non il costo.
 */
export function computeRealizedGains(
  transactions: InvestmentTransactionInput[],
  instruments: TaxInstrument[],
  toKey: string
): RealizedGain[] {
  const byId = new Map(instruments.map((i) => [i.id, i]));
  const state = new Map<string, { quantity: number; cost: number }>();
  const result: RealizedGain[] = [];
  for (const t of sortTransactions(transactions)) {
    if (t.date > toKey) break;
    const instrument = byId.get(t.instrumentId);
    if (!instrument) continue;
    const position = state.get(t.instrumentId) ?? { quantity: 0, cost: 0 };
    const quantity = Number(t.quantity);
    const multiplier = priceMultiplier(instrument.priceUnit);
    const fx = Number(t.fxRate) || 1;
    const fees = Number(t.fees) || 0;
    if (t.type === "acquisto") {
      position.quantity += quantity;
      position.cost += quantity * Number(t.price) * multiplier * fx + fees;
    } else if (t.type === "split") {
      if (quantity > 0) position.quantity *= quantity;
    } else if (SELL_TYPES.has(t.type)) {
      const sold = Math.min(quantity, position.quantity);
      const average = position.quantity > QUANTITY_EPSILON ? position.cost / position.quantity : 0;
      const cost = average * sold;
      const proceeds = quantity * Number(t.price) * multiplier * fx - fees;
      const gain = proceeds - cost;
      const year = yearOf(t.date);
      const category = taxCategoryOf(instrument.type, gain);
      result.push({
        transactionId: t.id,
        instrumentId: t.instrumentId,
        date: t.date,
        year,
        quantity: sold,
        proceeds,
        cost,
        gain,
        category,
        rate: instrument.type === "crypto" ? cryptoTaxRate(year) : instrument.taxRate,
        withheld: Number(t.taxes) || 0,
        nonHarmonized: category === "capitale" && !instrument.harmonized,
        lossesUsed: null,
        estimatedTax: null,
      });
      position.cost -= cost;
      position.quantity -= sold;
      if (position.quantity < QUANTITY_EPSILON) {
        position.quantity = 0;
        position.cost = 0;
      }
    }
    state.set(t.instrumentId, position);
  }
  return result;
}

/** Minusvalenza nello zaino. `amount`/`remaining` in base 26% (per le crypto in valore nominale). */
export interface LossEntry {
  /** Anno di origine: si usa fino al 31/12 di `expiresYear`. */
  year: number;
  expiresYear: number;
  amount: number;
  remaining: number;
  origin: "calcolata" | "manuale";
  crypto: boolean;
}

/** Minusvalenza pregressa inserita a mano. */
export interface ManualLossInput {
  year: number;
  amount: number;
}

/** Cifre fiscali di un anno. Importi in valuta utente. */
export interface TaxYear {
  year: number;
  /** Plusvalenze "redditi diversi" (azioni, obbligazioni, ETC), nominali. */
  gains: number;
  /** Minusvalenze (anche di ETF), nominali, positive. */
  losses: number;
  /** Guadagni di ETF/fondi: redditi di capitale, non compensabili. */
  fundGains: number;
  cryptoGains: number;
  cryptoLosses: number;
  /** Zaino (base 26%) usato, generato e scaduto nell'anno; crypto a parte. */
  lossesUsed: number;
  lossesCreated: number;
  lossesExpired: number;
  cryptoLossesUsed: number;
  cryptoLossesCreated: number;
  taxOnGains: number;
  taxOnFunds: number;
  taxOnCrypto: number;
  /** Imposte stimate su plus/minus dell'anno. */
  estimatedTax: number;
  /** Imposte trattenute registrate sulle vendite. */
  withheld: number;
  /** Dividendi e cedole: lordo, ritenute registrate. */
  incomeGross: number;
  incomeWithheld: number;
  /** Bollo stimato (0 se non calcolato). */
  bollo: number;
  /** Plus di ETF non armonizzati nell'anno (stima al 26%). */
  nonHarmonizedCount: number;
}

function emptyYear(year: number): TaxYear {
  return {
    year,
    gains: 0,
    losses: 0,
    fundGains: 0,
    cryptoGains: 0,
    cryptoLosses: 0,
    lossesUsed: 0,
    lossesCreated: 0,
    lossesExpired: 0,
    cryptoLossesUsed: 0,
    cryptoLossesCreated: 0,
    taxOnGains: 0,
    taxOnFunds: 0,
    taxOnCrypto: 0,
    estimatedTax: 0,
    withheld: 0,
    incomeGross: 0,
    incomeWithheld: 0,
    bollo: 0,
    nonHarmonizedCount: 0,
  };
}

/** Usa lo zaino (più vecchio prima) fino a `amount`, tra le voci utilizzabili nell'anno. Restituisce l'usato. */
function consumeLosses(entries: LossEntry[], amount: number, year: number, crypto: boolean): number {
  let left = amount;
  for (const entry of entries) {
    if (left <= 0) break;
    if (entry.crypto !== crypto || entry.remaining <= 0 || entry.expiresYear < year) continue;
    const used = Math.min(entry.remaining, left);
    entry.remaining -= used;
    left -= used;
  }
  return amount - left;
}

function addLoss(entries: LossEntry[], year: number, amount: number, origin: LossEntry["origin"], crypto: boolean): void {
  if (amount <= 0) return;
  entries.push({ year, expiresYear: year + LOSS_CARRY_YEARS, amount, remaining: amount, origin, crypto });
  entries.sort((a, b) => a.year - b.year);
}

/** Esito del calcolo fiscale. */
export interface TaxReport {
  regime: TaxRegime;
  /** Dal primo anno con operazioni (o minusvalenze pregresse) a quello di `todayKey`. */
  years: TaxYear[];
  realized: RealizedGain[];
  /** Zaino ancora utilizzabile dopo l'ultimo anno (voci scadute o esaurite escluse). */
  losses: LossEntry[];
}

/** Proventi (dividendi, cedole) di un anno: lordo e ritenute registrate, in valuta utente. */
function addIncome(years: Map<number, TaxYear>, transactions: InvestmentTransactionInput[], toKey: string): void {
  for (const t of transactions) {
    if ((t.type !== "dividendo" && t.type !== "cedola") || t.date > toKey) continue;
    const year = years.get(yearOf(t.date));
    if (!year) continue;
    year.incomeGross += Number(t.grossAmount ?? 0) * (Number(t.fxRate) || 1);
    year.incomeWithheld += Number(t.taxes) || 0;
  }
}

/**
 * Calcolo fiscale completo. Amministrato: le operazioni si scorrono in ordine e una minusvalenza compensa solo plus
 * successive. Dichiarativo: netto annuo, poi zaino degli anni precedenti. Le crypto seguono sempre il dichiarativo.
 */
export function computeTaxReport(params: {
  transactions: InvestmentTransactionInput[];
  instruments: TaxInstrument[];
  regime: TaxRegime;
  manualLosses?: ManualLossInput[];
  todayKey: string;
}): TaxReport {
  const { transactions, instruments, regime, todayKey } = params;
  const manualLosses = params.manualLosses ?? [];
  const realized = computeRealizedGains(transactions, instruments, todayKey);
  const currentYear = yearOf(todayKey);
  const firstYears = [
    ...transactions.map((t) => yearOf(t.date)),
    ...manualLosses.map((m) => m.year),
  ].filter((y) => y <= currentYear);
  if (firstYears.length === 0) return { regime, years: [], realized, losses: [] };

  const firstYear = Math.min(...firstYears);
  const years = new Map<number, TaxYear>();
  for (let y = firstYear; y <= currentYear; y += 1) years.set(y, emptyYear(y));
  const entries: LossEntry[] = [];

  for (let y = firstYear; y <= currentYear; y += 1) {
    const summary = years.get(y)!;
    const events = realized.filter((r) => r.year === y);
    const manual = manualLosses.filter((m) => m.year === y);
    // Amministrato: le pregresse di quest'anno servono già da gennaio.
    if (regime === "amministrato") for (const m of manual) addLoss(entries, y, m.amount, "manuale", false);

    let netDiversi = 0;
    let netCrypto = 0;
    for (const event of events) {
      summary.withheld += event.withheld;
      if (event.category === "crypto") {
        netCrypto += event.gain;
        if (event.gain >= 0) summary.cryptoGains += event.gain;
        else summary.cryptoLosses += -event.gain;
        continue;
      }
      if (event.category === "capitale") {
        const tax = event.gain * event.rate;
        summary.fundGains += event.gain;
        summary.taxOnFunds += tax;
        if (event.nonHarmonized) summary.nonHarmonizedCount += 1;
        if (regime === "amministrato") {
          event.lossesUsed = 0;
          event.estimatedTax = tax;
        }
        continue;
      }
      const equivalent = toBaseEquivalent(event.gain, event.rate);
      if (event.gain >= 0) summary.gains += event.gain;
      else summary.losses += -event.gain;
      if (regime === "amministrato") {
        if (equivalent >= 0) {
          const used = consumeLosses(entries, equivalent, y, false);
          const tax = (equivalent - used) * BASE_TAX_RATE;
          summary.lossesUsed += used;
          summary.taxOnGains += tax;
          event.lossesUsed = used;
          event.estimatedTax = tax;
        } else {
          addLoss(entries, y, -equivalent, "calcolata", false);
          summary.lossesCreated += -equivalent;
          event.lossesUsed = 0;
          event.estimatedTax = 0;
        }
      } else {
        netDiversi += equivalent;
      }
    }

    if (regime === "dichiarativo") {
      if (netDiversi > 0) {
        const used = consumeLosses(entries, netDiversi, y, false);
        summary.lossesUsed += used;
        summary.taxOnGains += (netDiversi - used) * BASE_TAX_RATE;
      } else if (netDiversi < 0) {
        addLoss(entries, y, -netDiversi, "calcolata", false);
        summary.lossesCreated += -netDiversi;
      }
      // Dichiarativo: la pregressa dell'anno è il residuo di quell'anno, utilizzabile dagli anni dopo.
      for (const m of manual) addLoss(entries, y, m.amount, "manuale", false);
    }

    // Crypto: netto annuo, franchigia fino al 2024, zaino solo crypto.
    if (netCrypto > 0) {
      const exempt = y <= CRYPTO_EXEMPTION_LAST_YEAR && netCrypto <= CRYPTO_EXEMPTION;
      if (!exempt) {
        const used = consumeLosses(entries, netCrypto, y, true);
        summary.cryptoLossesUsed += used;
        summary.taxOnCrypto += (netCrypto - used) * cryptoTaxRate(y);
      }
    } else if (netCrypto < 0) {
      addLoss(entries, y, -netCrypto, "calcolata", true);
      summary.cryptoLossesCreated += -netCrypto;
    }

    summary.estimatedTax = summary.taxOnGains + summary.taxOnFunds + summary.taxOnCrypto;
    // Fine anno: scade ciò che non si può più usare (l'anno in corso non è ancora finito).
    if (y < currentYear) {
      for (const entry of entries) {
        if (entry.expiresYear === y && entry.remaining > 0) {
          if (!entry.crypto) summary.lossesExpired += entry.remaining;
          entry.remaining = 0;
        }
      }
    }
  }

  addIncome(years, transactions, todayKey);
  return {
    regime,
    years: [...years.values()],
    realized,
    losses: entries.filter((e) => e.remaining > 0.005),
  };
}

/** Zaino disponibile (base 26%, non crypto) raggruppato per anno di scadenza. */
export function lossesByExpiry(losses: LossEntry[], crypto = false): { expiresYear: number; amount: number }[] {
  const byYear = new Map<number, number>();
  for (const entry of losses) {
    if (entry.crypto !== crypto) continue;
    byYear.set(entry.expiresYear, (byYear.get(entry.expiresYear) ?? 0) + entry.remaining);
  }
  return [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([expiresYear, amount]) => ({ expiresYear, amount }));
}

function daysInYear(year: number): number {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365;
}

/** Bollo stimato di un anno. */
export interface BolloYear {
  year: number;
  /** Valore a fine anno (per l'anno in corso: oggi). */
  value: number;
  /** Giorni dell'anno con qualcosa investito. */
  days: number;
  bollo: number;
  /** Anno in corso: stima "se il valore restasse questo". */
  estimate: boolean;
}

/**
 * Bollo dello 0,2% sul valore a fine anno, in proporzione ai giorni con qualcosa investito (il primo anno, o un anno
 * in cui il portafoglio è stato vuoto per un po'). Per l'anno in corso si usa il valore di oggi.
 */
export function computeBollo(daily: PortfolioDailyPoint[], todayKey: string): BolloYear[] {
  const currentYear = yearOf(todayKey);
  const byYear = new Map<number, { value: number; days: number }>();
  for (const point of daily) {
    if (point.date > todayKey) break;
    const year = yearOf(point.date);
    const entry = byYear.get(year) ?? { value: 0, days: 0 };
    if (point.value > 0) entry.days += 1;
    entry.value = point.value;
    byYear.set(year, entry);
  }
  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, { value, days }]) => {
      const estimate = year === currentYear;
      // L'anno in corso si proietta a fine anno: dal primo giorno investito fino al 31/12.
      const firstInvested = daily.find((p) => yearOf(p.date) === year && p.value > 0)?.date ?? null;
      const projectedDays =
        estimate && firstInvested
          ? Math.round((Date.UTC(year, 11, 31) - Date.parse(`${firstInvested}T00:00:00Z`)) / 86_400_000) + 1
          : days;
      const share = Math.min(1, projectedDays / daysInYear(year));
      return { year, value, days: projectedDays, bollo: value * BOLLO_RATE * share, estimate };
    });
}

/** Esito della simulazione di una vendita di oggi. */
export interface SaleSimulation {
  proceeds: number;
  cost: number;
  gain: number;
  category: TaxCategory;
  /** Differenza di imposte dell'anno (negativa: una minusvalenza fa risparmiare nel dichiarativo). */
  taxDelta: number;
  /** Zaino usato in più (base 26%) e generato in più. */
  lossesUsed: number;
  lossesCreated: number;
  /** Incasso meno le imposte in più. */
  net: number;
  nonHarmonized: boolean;
}

export const SIMULATED_TRANSACTION_ID = "simulazione";

/**
 * Simula la vendita di `quantity` quote a `price` (valuta dello strumento, cambio `fxRate`) a `todayKey`:
 * ricalcola tutto con la vendita in più e confronta le cifre dell'anno. Stesse regole del calcolo vero.
 */
export function simulateSale(params: {
  transactions: InvestmentTransactionInput[];
  instruments: TaxInstrument[];
  regime: TaxRegime;
  manualLosses?: ManualLossInput[];
  todayKey: string;
  instrumentId: string;
  quantity: number;
  price: number;
  fxRate: number;
  fees?: number;
}): SaleSimulation | null {
  const { instrumentId, quantity, price, fxRate, todayKey } = params;
  if (!(quantity > 0) || !(price > 0)) return null;
  const simulated: InvestmentTransactionInput = {
    id: SIMULATED_TRANSACTION_ID,
    instrumentId,
    type: "vendita",
    date: todayKey,
    quantity: String(quantity),
    price: String(price),
    fxRate: String(fxRate),
    fees: String(params.fees ?? 0),
    taxes: "0",
    grossAmount: null,
  };
  const before = computeTaxReport(params);
  const after = computeTaxReport({ ...params, transactions: [...params.transactions, simulated] });
  const event = after.realized.find((r) => r.transactionId === SIMULATED_TRANSACTION_ID);
  if (!event) return null;
  const year = yearOf(todayKey);
  const b = before.years.find((y) => y.year === year) ?? emptyYear(year);
  const a = after.years.find((y) => y.year === year) ?? emptyYear(year);
  const taxDelta = a.estimatedTax - b.estimatedTax;
  return {
    proceeds: event.proceeds,
    cost: event.cost,
    gain: event.gain,
    category: event.category,
    taxDelta,
    lossesUsed: a.lossesUsed - b.lossesUsed + (a.cryptoLossesUsed - b.cryptoLossesUsed),
    lossesCreated: a.lossesCreated - b.lossesCreated + (a.cryptoLossesCreated - b.cryptoLossesCreated),
    net: event.proceeds - taxDelta,
    nonHarmonized: event.nonHarmonized,
  };
}
