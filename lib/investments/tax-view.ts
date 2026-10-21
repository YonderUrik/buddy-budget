import { investmentTaxReport } from "./tax-report";
import { buildFxTable, convertAmount, type FxTable } from "@/lib/calc/fx";
import {
  buildPriceIndex,
  computeDailyPortfolioValues,
  computePortfolioSummary,
  type InvestmentTransactionInput,
  type PositionRow,
} from "@/lib/calc/investments";
import { toDateKey } from "@/lib/calc/net-worth";
import { startOfDay } from "@/lib/calc/expenses";
import { computeBollo, type BolloYear, type TaxInstrument, type TaxReport } from "@/lib/calc/taxes";
import type { Instrument, TaxRegime } from "@/lib/db/schema/investments";
import type { InvestmentData } from "./data";
import { computeTaxOpportunities, type TaxOpportunities } from "./tax-insights";
import { resolveTaxSettings, toTaxInstruments, type InstrumentSettingInput, type ResolvedTaxSettings } from "./tax-settings";
import { toTransactionInputs } from "./view";

/** Posizione vendibile nel simulatore "Prima di vendere". */
export interface SellablePosition {
  instrument: Instrument;
  quantity: number;
  /** Ultimo prezzo nella valuta dello strumento, null senza prezzo. */
  price: number | null;
  /** Cambio di oggi valuta strumento → utente, null se manca. */
  fxRate: number | null;
}

/** Dati della scheda Tasse già calcolati. */
export interface TaxView {
  currency: string;
  todayKey: string;
  currentYear: number;
  regime: TaxRegime;
  report: TaxReport;
  bollo: BolloYear[];
  opportunities: TaxOpportunities;
  instruments: Instrument[];
  /** Strumenti della lista "Aliquote": posizioni aperte e titoli con un evento tassato nell'anno in corso. */
  rateListInstruments: Instrument[];
  instrumentsById: Map<string, Instrument>;
  taxInstruments: TaxInstrument[];
  transactions: InvestmentTransactionInput[];
  settingsById: Map<string, InstrumentSettingInput>;
  resolved: Map<string, ResolvedTaxSettings>;
  sellable: SellablePosition[];
  carryforwards: InvestmentData["taxCarryforwards"];
  hasTransactions: boolean;
}

/** Open positions with today's last price and FX rate, for the sale simulator. */
export function sellablePositions(rows: PositionRow[], byId: Map<string, Instrument>, fx: FxTable, currency: string, todayKey: string): SellablePosition[] {
  return rows.flatMap((row) => {
    const instrument = byId.get(row.instrument.id);
    if (!instrument) return [];
    return [
      {
        instrument,
        quantity: row.quantity,
        price: row.lastPrice?.close ?? null,
        fxRate: convertAmount(fx, 1, instrument.currency, currency, todayKey),
      },
    ];
  });
}

/** Tipi di operazione che generano imposta nell'anno: vendite, rimborsi e proventi. */
const TAXED_TYPES: ReadonlySet<InvestmentTransactionInput["type"]> = new Set(["vendita", "rimborso", "dividendo", "cedola"]);

/**
 * Strumenti da mostrare nella lista delle aliquote: quelli ancora in portafoglio e quelli con un evento
 * tassato nell'anno in corso. Esclude i titoli chiusi negli anni passati e quelli presenti solo
 * nell'allocazione obiettivo.
 */
export function rateListInstruments(instruments: Instrument[], openIds: ReadonlySet<string>, transactions: InvestmentTransactionInput[], currentYear: number): Instrument[] {
  const yearPrefix = `${currentYear}-`;
  const taxedThisYear = new Set(transactions.filter((t) => TAXED_TYPES.has(t.type) && t.date.startsWith(yearPrefix)).map((t) => t.instrumentId));
  return instruments.filter((i) => openIds.has(i.id) || taxedThisYear.has(i.id));
}

/** Calcola la scheda Tasse dai dati dell'overview (serve lo storico completo dei prezzi per il bollo). */
export function buildTaxView(data: InvestmentData, today: Date): TaxView {
  const todayKey = toDateKey(startOfDay(today));
  const transactions = toTransactionInputs(data);
  const priceIndex = buildPriceIndex(data.prices, data.manualPrices, transactions);
  const fx = buildFxTable(data.fxRates);
  const regime = data.portfolios[0]?.taxRegime ?? "amministrato";
  const taxInstruments = toTaxInstruments(data.instruments, data.instrumentSettings);
  const report = investmentTaxReport(data, transactions, todayKey);
  const first = transactions.map((t) => t.date).sort()[0];
  const daily = first
    ? computeDailyPortfolioValues({ transactions, instruments: data.instruments, priceIndex, fx, userCurrency: data.currency, fromKey: first, toKey: todayKey })
    : [];
  const bollo = computeBollo(daily, todayKey);
  for (const year of report.years) year.bollo = bollo.find((b) => b.year === year.year)?.bollo ?? 0;
  const summary = computePortfolioSummary({ transactions, instruments: data.instruments, priceIndex, fx, userCurrency: data.currency, todayKey });
  const instrumentsById = new Map(data.instruments.map((i) => [i.id, i]));
  const settingsById = new Map(data.instrumentSettings.map((s) => [s.instrumentId, s]));
  const currentYear = Number(todayKey.slice(0, 4));
  return {
    currency: data.currency,
    todayKey,
    currentYear,
    regime,
    report,
    bollo,
    opportunities: computeTaxOpportunities(summary.rows, taxInstruments, report.losses, currentYear),
    instruments: data.instruments,
    rateListInstruments: rateListInstruments(data.instruments, new Set(summary.rows.map((r) => r.instrument.id)), transactions, currentYear),
    instrumentsById,
    taxInstruments,
    transactions,
    settingsById,
    resolved: new Map(data.instruments.map((i) => [i.id, resolveTaxSettings(i, settingsById.get(i.id))])),
    sellable: sellablePositions(summary.rows, instrumentsById, fx, data.currency, todayKey),
    carryforwards: data.taxCarryforwards,
    hasTransactions: transactions.length > 0,
  };
}
