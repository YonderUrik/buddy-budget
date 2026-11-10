/**
 * Investimenti · Proventi and Tasse (Italy) computed on the server (gaps.md G8): `buildIncomeView` and `buildTaxView`,
 * the functions those tabs run in the browser, serialized for JSON (Maps become arrays), plus the «Prima di vendere»
 * simulation (`simulateSale`) as a pure call. Pure: the loader is `investments-data.server.ts`.
 */
import { buildFxTable } from "@/lib/calc/fx";
import { buildPriceIndex, computePortfolioSummary } from "@/lib/calc/investments";
import { startOfDay } from "@/lib/calc/expenses";
import { toDateKey } from "@/lib/calc/net-worth";
import { simulateSale } from "@/lib/calc/taxes";
import type { InvestmentData } from "@/lib/investments/data";
import { buildIncomeView } from "@/lib/investments/income-view";
import { SALE_CATEGORY_TEXT, SALE_NON_HARMONIZED_TEXT, saleTaxLineLabel } from "@/lib/investments/sale-simulation-text";
import { buildTaxView, sellablePositions } from "@/lib/investments/tax-view";
import { toTaxInstruments } from "@/lib/investments/tax-settings";
import { toTransactionInputs } from "@/lib/investments/view";
import type { Language } from "@/lib/localization/config";
import { translate } from "@/lib/localization/messages";

/** Proventi: history, missing income to record, 12-month forecast, by month and by instrument; before tax with `taxes: false`. */
export function buildInvestmentsIncome(data: InvestmentData, today: Date, options: { taxes?: boolean } = {}) {
  const { instrumentsById, taxSettings, ...view } = buildIncomeView(data, today, options);
  return {
    ...view,
    instruments: [...instrumentsById.values()],
    taxSettings: [...taxSettings.entries()].map(([instrumentId, settings]) => ({ instrumentId, ...settings })),
    dismissed: data.dismissedDividends,
  };
}

/** Tasse (IT): yearly report, stamp duty, loss carryforwards, opportunities, rates per instrument, sellable positions. */
export function buildInvestmentsTaxes(data: InvestmentData, today: Date) {
  // The raw operations, tax instruments and Maps the browser needs for its own simulator stay out: the simulation is
  // `POST /api/investments/taxes/simulate-sale`.
  const { instrumentsById, settingsById, resolved, transactions, taxInstruments, rateListInstruments, ...view } = buildTaxView(data, today);
  void instrumentsById;
  void transactions;
  void taxInstruments;
  return {
    ...view,
    rateListInstrumentIds: rateListInstruments.map((i) => i.id),
    settings: [...settingsById.values()],
    resolved: [...resolved.entries()].map(([instrumentId, settings]) => ({ instrumentId, ...settings })),
  };
}

export interface SaleSimulationRequest {
  instrumentId: string;
  /** Units to sell; clamped to the units held, as the web card does. */
  quantity: number;
  /** Price in the instrument's currency; default: the last price. */
  price?: number;
  /** Instrument → user currency rate; default: today's ECB rate. */
  fxRate?: number;
  fees?: number;
}

/**
 * «Prima di vendere»: `simulateSale` on the user's operations, tax instruments, regime and carryforwards, with the
 * position's last price and today's FX rate unless given. Null when the instrument is not held or has no price/rate.
 */
export function simulateInvestmentSale(data: InvestmentData, today: Date, request: SaleSimulationRequest, language: Language) {
  const todayKey = toDateKey(startOfDay(today));
  const transactions = toTransactionInputs(data);
  const priceIndex = buildPriceIndex(data.prices, data.manualPrices, transactions);
  const fx = buildFxTable(data.fxRates);
  const summary = computePortfolioSummary({ transactions, instruments: data.instruments, priceIndex, fx, userCurrency: data.currency, todayKey });
  const position = sellablePositions(summary.rows, new Map(data.instruments.map((i) => [i.id, i])), fx, data.currency, todayKey).find((p) => p.instrument.id === request.instrumentId);
  if (!position) return null;
  const price = request.price ?? position.price;
  const fxRate = request.fxRate ?? position.fxRate;
  if (price === null || fxRate === null) return null;
  const quantity = Math.min(request.quantity, position.quantity);
  const regime = data.portfolios[0]?.taxRegime ?? "amministrato";
  const result = simulateSale({
    transactions,
    instruments: toTaxInstruments(data.instruments, data.instrumentSettings),
    regime,
    manualLosses: data.taxCarryforwards.map((c) => ({ year: c.year, amount: Number(c.amount) })),
    todayKey,
    instrumentId: position.instrument.id,
    quantity,
    price,
    fxRate,
    fees: request.fees,
  });
  if (!result) return null;
  const tr = (source: string) => translate(language, source);
  return {
    ...result,
    instrumentId: position.instrument.id,
    todayKey,
    regime,
    quantity,
    heldQuantity: position.quantity,
    price,
    fxRate,
    taxLineLabel: tr(saleTaxLineLabel(result, regime)),
    note: tr(SALE_CATEGORY_TEXT[result.category]) + (result.nonHarmonized ? tr(SALE_NON_HARMONIZED_TEXT) : ""),
  };
}

export type InvestmentsIncome = ReturnType<typeof buildInvestmentsIncome>;
export type InvestmentsTaxes = ReturnType<typeof buildInvestmentsTaxes>;
export type SaleSimulationResult = NonNullable<ReturnType<typeof simulateInvestmentSale>>;
