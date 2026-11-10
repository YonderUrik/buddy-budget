/* Golden vector generator for the investments domain. Run from repo root:
   npx tsx --tsconfig tsconfig.json <this file> <outDir> */
import { writeFileSync, mkdirSync } from "node:fs";
import * as I from "@/lib/calc/investments";
import * as FX from "@/lib/calc/fx";
import * as T from "@/lib/calc/taxes";
import * as R from "@/lib/calc/returns";
import * as H from "@/lib/calc/return-heatmap";
import * as PR from "@/lib/calc/performance-range";
import * as RK from "@/lib/calc/risk";
import * as RX from "@/lib/calc/risk-extras";
import * as C from "@/lib/calc/costs";
import * as TS from "@/lib/investments/title-stats";
import * as TSET from "@/lib/investments/tax-settings";
import * as TREP from "@/lib/investments/tax-report";
import * as TINS from "@/lib/investments/tax-insights";
import * as DIV from "@/lib/investments/dividends";
import * as EXP from "@/lib/investments/exposure";
import * as AL from "@/lib/investments/allocation";
import * as OV from "@/lib/investments/overlap";
import * as CI from "@/lib/investments/cost-impact";
import * as PG from "@/lib/investments/period-gain";

const outDir = process.argv[2];
mkdirSync(outDir, { recursive: true });

// Maps → plain objects, -0 → 0, round floats to 12 significant digits for stable JSON.
function plain(v: unknown): unknown {
  if (v instanceof Map) return Object.fromEntries([...v.entries()].map(([k, x]) => [String(k), plain(x)]));
  if (Array.isArray(v)) return v.map(plain);
  if (v instanceof RegExp) return v.source;
  if (v && typeof v === "object" && "profile" in v && "useSectors" in v) { const m = v as { profile: { id: string }; useSectors: boolean; broad: boolean }; return { profileId: m.profile.id, useSectors: m.useSectors, broad: m.broad }; }
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  if (typeof v === "number") {
    if (Object.is(v, -0)) return 0;
    if (!Number.isFinite(v)) return String(v);
    return Number(v.toPrecision(12));
  }
  return v;
}

type Vec = { id: string; function: string; input: unknown; expected: unknown; tolerance: number; notes?: string };
const files: Record<string, { topic: string; source: string; vectors: Vec[] }> = {};
function file(name: string, topic: string, source: string) {
  files[name] = { topic, source, vectors: [] };
  return (id: string, fn: string, input: unknown, expected: unknown, notes?: string, tolerance = 1e-9) =>
    files[name].vectors.push({ id, function: fn, input: plain(input), expected: plain(expected), tolerance, ...(notes ? { notes } : {}) });
}

// ---------- helpers ----------
let n = 0;
const tx = (instrumentId: string, type: I.InvestmentTransactionInput["type"], date: string, quantity: number, price: number, o: Partial<{ fx: number; fees: number; taxes: number; gross: number | null }> = {}): I.InvestmentTransactionInput => ({
  id: `t${++n}`, instrumentId, type, date, quantity: String(quantity), price: String(price), fxRate: String(o.fx ?? 1), fees: String(o.fees ?? 0), taxes: String(o.taxes ?? 0), grossAmount: o.gross === undefined || o.gross === null ? null : String(o.gross),
});
const inst = (id: string, type: I.InstrumentInput["type"], currency = "EUR", priceUnit: I.InstrumentInput["priceUnit"] = "unita", name = id): I.InstrumentInput => ({ id, name, type, currency, priceUnit });
const taxInst = (i: I.InstrumentInput, taxRate = 0.26, harmonized = true): T.TaxInstrument => ({ ...i, taxRate, harmonized });
const d = (key: string) => { const [y, m, dd] = key.split("-").map(Number); return new Date(y, m - 1, dd); };

// =============== investments.json ===============
{
  const v = file("investments", "investments-positions", "lib/calc/investments.ts");
  v("investments.priceMultiplier.unit", "priceMultiplier", { unit: "unita" }, I.priceMultiplier("unita"));
  v("investments.priceMultiplier.bond", "priceMultiplier", { unit: "percentuale_nominale" }, I.priceMultiplier("percentuale_nominale"));
  n = 0;
  const sortIn = [tx("A", "vendita", "2026-01-10", 1, 10), tx("A", "acquisto", "2026-01-10", 1, 10), tx("A", "split", "2026-01-10", 2, 0), tx("A", "dividendo", "2026-01-10", 0, 0, { gross: 1 }), tx("A", "acquisto", "2026-01-09", 1, 10)];
  v("investments.sortTransactions.sameDayOrder", "sortTransactions", { transactions: sortIn }, I.sortTransactions(sortIn).map((t) => `${t.date}:${t.type}`), "Expected is the sorted list rendered as 'date:type'. Same-day order: split(-1) < acquisto(0) < dividendo/cedola/rettifica(1) < vendita/rimborso(2). Sort must be stable.");

  // Weighted average cost
  n = 0;
  const instA = inst("A", "azione");
  const posTx1 = [tx("A", "acquisto", "2026-01-05", 10, 100, { fees: 5 }), tx("A", "acquisto", "2026-02-05", 10, 120, { fees: 5 })];
  v("investments.computePositions.twoBuys", "computePositions", { transactions: posTx1, instruments: [instA], asOfKey: "2026-12-31" }, I.computePositions(posTx1, [instA], "2026-12-31"), "Average cost includes buy fees: (1000+5+1200+5)/20 = 110.5");
  n = 0;
  const posTx2 = [tx("A", "acquisto", "2026-01-05", 10, 100, { fees: 5 }), tx("A", "acquisto", "2026-02-05", 10, 120, { fees: 5 }), tx("A", "vendita", "2026-03-05", 5, 130, { fees: 3, taxes: 10 })];
  v("investments.computePositions.partialSell", "computePositions", { transactions: posTx2, instruments: [instA], asOfKey: "2026-12-31" }, I.computePositions(posTx2, [instA], "2026-12-31"), "Sell proceeds net of fees AND withheld taxes: 650-3-10=637; realized = 637 - 110.5*5 = 84.5");
  n = 0;
  const posTx3 = [tx("A", "acquisto", "2026-01-05", 10, 100), tx("A", "split", "2026-02-01", 3, 0), tx("A", "vendita", "2026-02-01", 30, 40)];
  v("investments.computePositions.splitThenSellAll", "computePositions", { transactions: posTx3, instruments: [instA], asOfKey: "2026-12-31" }, I.computePositions(posTx3, [instA], "2026-12-31"), "Split multiplies quantity, keeps cost; selling everything zeroes quantity and costBasis; averagePrice null when quantity is 0.");
  n = 0;
  const bond = inst("B", "obbligazione", "USD", "percentuale_nominale");
  const posTx4 = [tx("B", "acquisto", "2026-01-05", 10000, 98.5, { fx: 0.9, fees: 2 }), tx("B", "cedola", "2026-06-01", 0, 0, { fx: 0.92, gross: 200, taxes: 23 })];
  v("investments.computePositions.bondPercentNominalFx", "computePositions", { transactions: posTx4, instruments: [bond], asOfKey: "2026-12-31" }, I.computePositions(posTx4, [bond], "2026-12-31"), "Cost = 10000*98.5*0.01*0.9 + 2. averagePrice expressed back in % of nominal (cost/(qty*0.01)). Coupon income = gross*fx - taxes - fees = 200*0.92-23.");
  n = 0;
  const posTx5 = [tx("A", "rettifica", "2026-01-05", 4, 0, { gross: 400 }), tx("A", "acquisto", "2026-03-01", 1, 50), tx("A", "acquisto", "2027-01-01", 1, 50)];
  v("investments.computePositions.rettificaAndAsOf", "computePositions", { transactions: posTx5, instruments: [instA], asOfKey: "2026-12-31" }, I.computePositions(posTx5, [instA], "2026-12-31"), "rettifica adds quantity and grossAmount*fx to costBasis but NOT to investedNet/totalBought; transactions after asOfKey ignored.");

  n = 0;
  const over = [tx("A", "acquisto", "2026-01-05", 5, 10), tx("A", "vendita", "2026-01-06", 3, 10), tx("A", "vendita", "2026-01-07", 3, 10)];
  v("investments.findOversoldTransaction.oversold", "findOversoldTransaction", { transactions: over }, I.findOversoldTransaction(over)?.id ?? null, "Expected = id of the first transaction that takes the quantity below -1e-9.");
  n = 0;
  const ok = [tx("A", "acquisto", "2026-01-05", 5, 10), tx("A", "vendita", "2026-01-05", 5, 10)];
  v("investments.findOversoldTransaction.sameDayOk", "findOversoldTransaction", { transactions: ok }, I.findOversoldTransaction(ok)?.id ?? null, "Same-day buy then sell is legal (buys sorted first).");

  // Price index precedence
  n = 0;
  const piTx = [tx("A", "acquisto", "2026-01-05", 1, 99)];
  const prices: I.PriceInput[] = [{ instrumentId: "A", date: "2026-01-05", close: "100", source: "yahoo" }, { instrumentId: "A", date: "2026-01-06", close: "101", source: "yahoo" }, { instrumentId: "A", date: "2026-01-07", close: "0", source: "yahoo" }];
  const manual: I.ManualPriceInput[] = [{ instrumentId: "A", date: "2026-01-06", close: "105" }];
  const idx = I.buildPriceIndex(prices, manual, piTx);
  v("investments.buildPriceIndex.precedence", "buildPriceIndex", { prices, manualPrices: manual, transactions: piTx }, idx, "Same-day precedence manuale(3) > auto provider(2) > operazione(1); ties: later candidate wins (>=). Non-positive/non-finite closes dropped.");
  v("investments.resolvePrice.lastOnOrBefore", "resolvePrice", { index: "from investments.buildPriceIndex.precedence", instrumentId: "A", dateKey: "2026-01-10" }, I.resolvePrice(idx, "A", "2026-01-10"));

  // Summary
  n = 0;
  const instE = inst("E", "etf", "EUR"), instU = inst("U", "azione", "USD"), instX = inst("X", "azione", "EUR");
  const sTx = [tx("E", "acquisto", "2026-01-05", 10, 100, { fees: 2 }), tx("U", "acquisto", "2026-01-05", 5, 200, { fx: 0.9 }), tx("X", "acquisto", "2026-01-05", 1, 50), tx("E", "dividendo", "2026-03-01", 0, 0, { gross: 10, taxes: 2.6 })];
  const sPrices: I.PriceInput[] = [
    { instrumentId: "E", date: "2026-10-16", close: "110", source: "yahoo" }, { instrumentId: "E", date: "2026-10-17", close: "112", source: "yahoo" },
    { instrumentId: "U", date: "2026-10-17", close: "210", source: "yahoo" },
  ];
  const fxRates: FX.FxRateInput[] = [{ date: "2026-10-01", currency: "USD", perEur: "1.1" }];
  const sIdx = I.buildPriceIndex(sPrices, [], []);
  const sum = I.computePortfolioSummary({ transactions: sTx, instruments: [instE, instU, instX], priceIndex: sIdx, fx: FX.buildFxTable(fxRates), userCurrency: "EUR", todayKey: "2026-10-18" });
  v("investments.computePortfolioSummary.mixed", "computePortfolioSummary", { transactions: sTx, instruments: [instE, instU, instX], prices: sPrices, manualPrices: [], priceIndexBuiltWithTransactions: false, fxRates, userCurrency: "EUR", todayKey: "2026-10-18" }, sum, "priceIndex built from prices only (no transaction fallback) so X is unpriced. USD value converted with latest perEur on or before today (200*... → 210*5/1.1). dayChange only over positions having both today's price and a price on (lastPrice.date - 1 day); U has no previous so excluded. rows sorted by value desc, unpriced last; weight = value/totalValue.");
  v("investments.computeComposition.byType", "computeComposition", { rows: "rows of investments.computePortfolioSummary.mixed", by: "type" }, I.computeComposition(sum.rows, "type"));
  v("investments.computeComposition.byCurrency", "computeComposition", { rows: "rows of investments.computePortfolioSummary.mixed", by: "currency" }, I.computeComposition(sum.rows, "currency"));

  n = 0;
  const dTx = [tx("E", "acquisto", "2026-01-02", 10, 100), tx("E", "vendita", "2026-01-04", 4, 105, { fees: 1 }), tx("E", "dividendo", "2026-01-04", 0, 0, { gross: 5, taxes: 1.3 })];
  const dPrices: I.PriceInput[] = [{ instrumentId: "E", date: "2026-01-02", close: "100", source: "yahoo" }, { instrumentId: "E", date: "2026-01-03", close: "102", source: "yahoo" }, { instrumentId: "E", date: "2026-01-04", close: "105", source: "yahoo" }];
  const daily = I.computeDailyPortfolioValues({ transactions: dTx, instruments: [instE], priceIndex: I.buildPriceIndex(dPrices, [], dTx), fx: new Map(), userCurrency: "EUR", fromKey: "2026-01-01", toKey: "2026-01-05" });
  v("investments.computeDailyPortfolioValues.basic", "computeDailyPortfolioValues", { transactions: dTx, instruments: [instE], prices: dPrices, manualPrices: [], priceIndexBuiltWithTransactions: true, fxRates: [], userCurrency: "EUR", fromKey: "2026-01-01", toKey: "2026-01-05" }, daily, "One point per calendar day, transactions of the day applied before valuing; last known price carried forward.");
}

// =============== fx (inside returns? separate) ===============
{
  const v = file("fx", "fx-conversion", "lib/calc/fx.ts");
  const rates: FX.FxRateInput[] = [
    { date: "2026-01-02", currency: "USD", perEur: "1.10" }, { date: "2026-01-05", currency: "USD", perEur: "1.12" },
    { date: "2026-01-02", currency: "GBP", perEur: "0.85" }, { date: "2026-01-03", currency: "CHF", perEur: "-1" },
  ];
  const t = FX.buildFxTable(rates);
  v("fx.getPerEur.eur", "getPerEur", { rates, currency: "EUR", dateKey: "2000-01-01" }, FX.getPerEur(t, "EUR", "2000-01-01"), "EUR is the pivot: always 1.");
  v("fx.getPerEur.carryForward", "getPerEur", { rates, currency: "USD", dateKey: "2026-01-04" }, FX.getPerEur(t, "USD", "2026-01-04"), "Weekend/holiday: last rate on or before date.");
  v("fx.getPerEur.beforeFirst", "getPerEur", { rates, currency: "USD", dateKey: "2026-01-01" }, FX.getPerEur(t, "USD", "2026-01-01"), "No rate on or before → null (value becomes 'unpriced').");
  v("fx.fxRateBetween.cross", "fxRateBetween", { rates, from: "USD", to: "GBP", dateKey: "2026-01-06" }, FX.fxRateBetween(t, "USD", "GBP", "2026-01-06"), "perTo/perFrom = 0.85/1.12");
  v("fx.convertAmount.usdToEur", "convertAmount", { rates, amount: 1000, from: "USD", to: "EUR", dateKey: "2026-01-05" }, FX.convertAmount(t, 1000, "USD", "EUR", "2026-01-05"));
  v("fx.convertAmount.invalidRateIgnored", "convertAmount", { rates, amount: 10, from: "CHF", to: "EUR", dateKey: "2026-01-05" }, FX.convertAmount(t, 10, "CHF", "EUR", "2026-01-05"), "perEur <= 0 rows are dropped at table build.");
}

// =============== italian-taxes.json ===============
{
  const v = file("italian-taxes", "italian-taxes", "lib/calc/taxes.ts, lib/investments/tax-settings.ts, lib/investments/tax-report.ts, lib/investments/tax-insights.ts, lib/investments/dividends.ts");
  v("taxes.cryptoTaxRate.2025", "cryptoTaxRate", { year: 2025 }, T.cryptoTaxRate(2025));
  v("taxes.cryptoTaxRate.2026", "cryptoTaxRate", { year: 2026 }, T.cryptoTaxRate(2026));
  v("taxes.toBaseEquivalent.govBond", "toBaseEquivalent", { amount: 1000, rate: 0.125 }, T.toBaseEquivalent(1000, 0.125), "A 12.5% gain/loss is worth 48.0769...% at the 26% base.");
  v("taxes.toBaseEquivalent.base", "toBaseEquivalent", { amount: -500, rate: 0.26 }, T.toBaseEquivalent(-500, 0.26));
  v("taxes.taxCategoryOf.etfGain", "taxCategoryOf", { type: "etf", gain: 10 }, T.taxCategoryOf("etf", 10));
  v("taxes.taxCategoryOf.etfLoss", "taxCategoryOf", { type: "etf", gain: -10 }, T.taxCategoryOf("etf", -10), "ETF/fund LOSS is 'redditi diversi' → goes into the loss pool (zainetto).");
  v("taxes.taxCategoryOf.crypto", "taxCategoryOf", { type: "crypto", gain: -10 }, T.taxCategoryOf("crypto", -10));

  // Realized gains
  n = 0;
  const A = taxInst(inst("A", "azione")), E = taxInst(inst("E", "etf")), B = taxInst(inst("B", "obbligazione", "EUR", "percentuale_nominale", "BTP 2030"), 0.125), K = taxInst(inst("K", "crypto"));
  const rTx = [tx("A", "acquisto", "2026-01-05", 10, 100, { fees: 5 }), tx("A", "vendita", "2026-03-05", 4, 120, { fees: 2, taxes: 3 })];
  v("taxes.computeRealizedGains.withheldNotDeducted", "computeRealizedGains", { transactions: rTx, instruments: [A], toKey: "2026-12-31" }, T.computeRealizedGains(rTx, [A], "2026-12-31"), "Unlike positions, the tax base deducts sell FEES but NOT withheld taxes: proceeds = 480-2 = 478; cost = 100.5*4 = 402; gain 76.");

  // Amministrato: loss then gain
  n = 0;
  const a1 = [tx("A", "acquisto", "2025-01-05", 10, 100), tx("A", "vendita", "2025-06-05", 10, 80), tx("E", "acquisto", "2025-01-05", 10, 100), tx("E", "vendita", "2026-02-01", 10, 150), tx("B", "acquisto", "2026-01-10", 10000, 100), tx("B", "vendita", "2026-05-10", 10000, 103)];
  const rep1 = T.computeTaxReport({ transactions: a1, instruments: [A, E, B], regime: "amministrato", todayKey: "2026-10-18" });
  v("taxes.computeTaxReport.amministrato.etfNotOffset", "computeTaxReport", { transactions: a1, instruments: [A, E, B], regime: "amministrato", manualLosses: [], todayKey: "2026-10-18" }, rep1, "2025: stock loss 200 → zaino 200 (expires 2029). 2026: ETF gain 500 is 'redditi di capitale' taxed in full at 26% (=130), zaino NOT used. BTP gain 300 at 12.5% → base equivalent 144.23, offset by zaino → tax 0, zaino left 55.77.");

  // Dichiarativo netting
  n = 0;
  const d1 = [tx("A", "acquisto", "2026-01-05", 10, 100), tx("A", "vendita", "2026-02-05", 5, 140), tx("A", "vendita", "2026-03-05", 5, 60)];
  const dIn = { transactions: d1, instruments: [A], regime: "dichiarativo" as const, manualLosses: [{ year: 2026, amount: 50 }], todayKey: "2026-10-18" };
  v("taxes.computeTaxReport.dichiarativo.netAnnual", "computeTaxReport", dIn, T.computeTaxReport(dIn), "Dichiarativo: annual net (+200 -200 = 0) → no tax, no loss. Manual loss of year Y is added AFTER the year's netting (usable from Y+1). Per-event lossesUsed/estimatedTax stay null.");
  const aIn = { ...dIn, regime: "amministrato" as const };
  v("taxes.computeTaxReport.amministrato.orderMatters", "computeTaxReport", aIn, T.computeTaxReport(aIn), "Same trades in amministrato: gain first (200, offset by manual 50 → tax 39), loss later creates zaino 200 that cannot go back in time.");

  // Expiry
  n = 0;
  const x1 = [tx("A", "acquisto", "2020-01-05", 10, 100), tx("A", "vendita", "2020-06-05", 10, 50), tx("A", "acquisto", "2025-01-05", 10, 100), tx("A", "vendita", "2025-03-05", 10, 150)];
  const xIn = { transactions: x1, instruments: [A], regime: "amministrato" as const, todayKey: "2026-10-18" };
  v("taxes.computeTaxReport.lossExpiry", "computeTaxReport", xIn, T.computeTaxReport(xIn), "2020 loss 500 usable until 31/12/2024 (2020+4): it expires at end 2024 (lossesExpired in 2024), so the 2025 gain is fully taxed (500*26%=130).");

  // Crypto
  n = 0;
  const c1 = [tx("K", "acquisto", "2024-01-05", 1, 1000), tx("K", "vendita", "2024-06-05", 1, 2500), tx("K", "acquisto", "2025-01-05", 1, 1000), tx("K", "vendita", "2025-02-05", 1, 600), tx("K", "acquisto", "2026-01-05", 1, 1000), tx("K", "vendita", "2026-02-05", 1, 2000)];
  const cIn = { transactions: c1, instruments: [K], regime: "amministrato" as const, todayKey: "2026-10-18" };
  v("taxes.computeTaxReport.crypto", "computeTaxReport", cIn, T.computeTaxReport(cIn), "Crypto always annual (declaration). 2024 net 1500 ≤ 2000 exemption → 0. 2025 loss 400 → crypto-only pool (nominal, not base-26). 2026 gain 1000 - 400 = 600 at 33% = 198.");

  // lossesByExpiry
  v("taxes.lossesByExpiry.basic", "lossesByExpiry", { losses: rep1.losses, crypto: false }, T.lossesByExpiry(rep1.losses));

  // Bollo
  const mk = (from: string, to: string, value: (k: string) => number) => {
    const out: I.PortfolioDailyPoint[] = [];
    for (let day = d(from); ; day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)) {
      const k = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      if (k > to) break;
      out.push({ date: k, value: value(k), invested: 0, bought: 0, income: 0 });
    }
    return out;
  };
  const b1 = mk("2025-07-01", "2026-10-18", (k) => (k < "2026-01-01" ? 10000 : 20000));
  v("taxes.computeBollo.partialFirstYearAndCurrent", "computeBollo", { daily: "daily points: value 10000 every day 2025-07-01..2025-12-31, 20000 every day 2026-01-01..2026-10-18", todayKey: "2026-10-18" }, T.computeBollo(b1, "2026-10-18"), "2025: 184 invested days/365 × 0.2% × year-end value. 2026 (current): estimate=true, projected days from first invested day to 31/12 → 365/365.");
  const b2 = mk("2024-01-01", "2024-12-31", (k) => (k >= "2024-03-01" && k < "2024-04-01" ? 0 : 5000));
  v("taxes.computeBollo.leapYearWithEmptyMonth", "computeBollo", { daily: "daily points 2024-01-01..2024-12-31 value 5000 except 0 during March 2024", todayKey: "2026-10-18" }, T.computeBollo(b2, "2026-10-18"), "Past year: days = days with value>0 (366-31=335), share = 335/366 (leap year).");

  // Sale simulation
  n = 0;
  const sTx = [tx("A", "acquisto", "2025-01-05", 10, 100), tx("A", "vendita", "2025-06-05", 5, 60), tx("E", "acquisto", "2025-01-05", 10, 100)];
  const sIn = { transactions: sTx, instruments: [A, E], regime: "amministrato" as const, todayKey: "2026-10-18" };
  v("taxes.simulateSale.stockUsesZaino", "simulateSale", { ...sIn, instrumentId: "A", quantity: 5, price: 150, fxRate: 1 }, T.simulateSale({ ...sIn, instrumentId: "A", quantity: 5, price: 150, fxRate: 1 }), "Stock gain 250 offset by zaino 200 → tax (250-200)*26% = 13. net = proceeds - taxDelta.");
  v("taxes.simulateSale.etfFullyTaxed", "simulateSale", { ...sIn, instrumentId: "E", quantity: 10, price: 150, fxRate: 1 }, T.simulateSale({ ...sIn, instrumentId: "E", quantity: 10, price: 150, fxRate: 1 }), "ETF gain 500 → 130 tax, zaino untouched.");
  v("taxes.simulateSale.lossCreatesZaino", "simulateSale", { ...sIn, instrumentId: "E", quantity: 10, price: 80, fxRate: 1 }, T.simulateSale({ ...sIn, instrumentId: "E", quantity: 10, price: 80, fxRate: 1 }), "ETF loss → lossesCreated 200, taxDelta 0.");
  v("taxes.simulateSale.invalid", "simulateSale", { ...sIn, instrumentId: "E", quantity: 0, price: 80, fxRate: 1 }, T.simulateSale({ ...sIn, instrumentId: "E", quantity: 0, price: 80, fxRate: 1 }), "quantity<=0 or price<=0 → null.");

  // resolveTaxSettings
  const base = { taxRate: "0.2600", taxHarmonized: null, createdByUserId: null };
  v("taxes.resolveTaxSettings.btpByName", "resolveTaxSettings", { instrument: { type: "obbligazione", name: "BTP Italia 2030", ...base }, setting: null }, TSET.resolveTaxSettings({ type: "obbligazione", name: "BTP Italia 2030", ...base }, undefined));
  v("taxes.resolveTaxSettings.manualOverride", "resolveTaxSettings", { instrument: { type: "obbligazione", name: "BTP Italia 2030", ...base }, setting: { taxRate: "0.26", taxHarmonized: null } }, TSET.resolveTaxSettings({ type: "obbligazione", name: "BTP Italia 2030", ...base }, { taxRate: "0.26", taxHarmonized: null }));
  v("taxes.resolveTaxSettings.sharedInstrumentIgnoresRowRate", "resolveTaxSettings", { instrument: { type: "etf", name: "Some ETF", taxRate: "0.125", taxHarmonized: false, createdByUserId: null }, setting: null }, TSET.resolveTaxSettings({ type: "etf", name: "Some ETF", taxRate: "0.125", taxHarmonized: false, createdByUserId: null }, undefined), "Shared (createdByUserId null) instrument: stored rate/harmonized ignored → 26%, harmonized presumed true.");
  v("taxes.resolveTaxSettings.privateNonHarmonized", "resolveTaxSettings", { instrument: { type: "etf", name: "My fund", taxRate: "0.26", taxHarmonized: false, createdByUserId: "u1" }, setting: null }, TSET.resolveTaxSettings({ type: "etf", name: "My fund", taxRate: "0.26", taxHarmonized: false, createdByUserId: "u1" }, undefined));
  v("taxes.looksLikeGovernmentBond.corporate", "looksLikeGovernmentBond", { instrument: { type: "obbligazione", name: "Enel 2029 3%" } }, TSET.looksLikeGovernmentBond({ type: "obbligazione", name: "Enel 2029 3%" }));

  // estimatedTaxCharges
  v("taxes.estimatedTaxCharges.amministrato", "estimatedTaxCharges", { report: "output of taxes.computeTaxReport.amministrato.etfNotOffset", todayKey: "2026-10-18" }, TREP.estimatedTaxCharges(rep1, "2026-10-18"), "Amministrato without crypto: yearly (estimatedTax - withheld) spread across the year's events pro-rata to each event's (estimatedTax - withheld), dated on the event.");
  const cRep = T.computeTaxReport(cIn);
  v("taxes.estimatedTaxCharges.cryptoYearEnd", "estimatedTaxCharges", { report: "output of taxes.computeTaxReport.crypto", todayKey: "2026-10-18" }, TREP.estimatedTaxCharges(cRep, "2026-10-18"), "Dichiarativo or crypto-year: whole remaining dated at 31/12 (or today for the open year).");

  // tax opportunities
  const opp = TINS.computeTaxOpportunities(
    [{ instrument: A, unrealizedGain: 300 }, { instrument: E, unrealizedGain: 400 }, { instrument: B, unrealizedGain: -100 }, { instrument: K, unrealizedGain: -50 }],
    [A, E, B, K], [{ year: 2022, expiresYear: 2026, amount: 80, remaining: 80, origin: "calcolata", crypto: false }], 2026);
  v("taxes.computeTaxOpportunities.basic", "computeTaxOpportunities", { rows: [{ instrumentId: "A", type: "azione", taxRate: 0.26, unrealizedGain: 300 }, { instrumentId: "E", type: "etf", taxRate: 0.26, unrealizedGain: 400 }, { instrumentId: "B", type: "obbligazione", taxRate: 0.125, unrealizedGain: -100 }, { instrumentId: "K", type: "crypto", taxRate: 0.26, unrealizedGain: -50 }], losses: [{ year: 2022, expiresYear: 2026, amount: 80, remaining: 80, origin: "calcolata", crypto: false }], currentYear: 2026 }, opp, "ETF gains are not compensable; crypto excluded; losses expressed as positive base-26 equivalents.");

  // Dividends
  v("dividends.shiftMonths.endOfMonthClamp", "shiftMonths", { dateKey: "2026-01-31", months: 1 }, DIV.shiftMonths("2026-01-31", 1));
  v("dividends.shiftMonths.leap", "shiftMonths", { dateKey: "2024-02-29", months: 12 }, DIV.shiftMonths("2024-02-29", 12));
  v("dividends.couponDates.semiannual", "couponDates", { terms: { rate: 0.035, frequency: 2, maturityDate: "2030-03-15" }, fromKey: "2025-01-01", toKey: "2026-10-18" }, DIV.couponDates({ rate: 0.035, frequency: 2, maturityDate: "2030-03-15" }, "2025-01-01", "2026-10-18"), "Dates counted backwards from maturity in steps of 12/frequency months; window is (from, to].");
  v("dividends.dividendGrowth.cagr", "dividendGrowth", { events: [{ exDate: "2021-05-01", amount: 1 }, { exDate: "2022-05-01", amount: 1.1 }, { exDate: "2023-05-01", amount: 1.2 }, { exDate: "2024-05-01", amount: 1.3 }, { exDate: "2025-05-01", amount: 0.7 }, { exDate: "2025-11-01", amount: 0.75 }], currentYear: 2026 }, DIV.dividendGrowth([{ exDate: "2021-05-01", amount: 1 }, { exDate: "2022-05-01", amount: 1.1 }, { exDate: "2023-05-01", amount: 1.2 }, { exDate: "2024-05-01", amount: 1.3 }, { exDate: "2025-05-01", amount: 0.7 }, { exDate: "2025-11-01", amount: 0.75 }], 2026), "Last 5 complete calendar years; (last/first)^(1/span)-1 = (1.45/1)^(1/4)-1.");
  n = 0;
  const incTx = [tx("E", "dividendo", "2026-03-10", 0, 0, { gross: 100, fx: 0.9, taxes: 23.4 }), tx("E", "cedola", "2026-03-20", 0, 0, { gross: 50, fees: 1 }), tx("E", "dividendo", "2025-12-01", 0, 0, { gross: 10 })];
  v("dividends.incomeByMonth.basic", "incomeByMonth", { transactions: incTx, todayKey: "2026-10-18" }, DIV.incomeByMonth(incTx, "2026-10-18"), "gross = grossAmount*fx; withheld = taxes+fees; years newest first; 12 months each.");

  n = 0;
  const divE = inst("E", "etf", "USD");
  const divTx = [tx("E", "acquisto", "2025-01-10", 100, 50, { fx: 0.9 })];
  const fxT = FX.buildFxTable([{ date: "2025-01-01", currency: "USD", perEur: "1.25" }]);
  const incomeInput: DIV.IncomeInput = { transactions: divTx, instruments: [divE], taxInstruments: [taxInst(divE)], settings: [], dividends: [{ instrumentId: "E", exDate: "2025-06-15", amount: "0.5" }, { instrumentId: "E", exDate: "2025-12-15", amount: "0.6" }], fx: fxT, userCurrency: "EUR", todayKey: "2026-01-20" };
  v("dividends.findMissingIncome.basic", "findMissingIncome", { ...incomeInput, fxRates: [{ date: "2025-01-01", currency: "USD", perEur: "1.25" }], dismissed: [] }, DIV.findMissingIncome(incomeInput, []), "Ex-dates after first buy with quantity held the day before, no registered income in [-5,+60] days, not dismissed. estimatedTax = gross × fx(instrument→user) × taxRate.");
  v("dividends.forecastIncome.fromSource", "forecastIncome", { ...incomeInput, fxRates: [{ date: "2025-01-01", currency: "USD", perEur: "1.25" }] }, DIV.forecastIncome(incomeInput), "Window = next 12 full calendar months. Source ex-dates of the same window one year earlier, shifted +12 months, times today's quantity, converted at TODAY's fx; net = gross × (1 - taxRate).");
}

// =============== returns.json ===============
{
  const v = file("returns", "returns", "lib/calc/returns.ts, lib/calc/performance-range.ts, lib/calc/return-heatmap.ts, lib/investments/period-gain.ts");
  const pts: I.PortfolioDailyPoint[] = [
    { date: "2026-01-01", value: 0, invested: 0, bought: 0, income: 0 },
    { date: "2026-01-02", value: 1000, invested: 1000, bought: 1000, income: 0 },
    { date: "2026-01-03", value: 1100, invested: 1000, bought: 1000, income: 0 },
    { date: "2026-01-04", value: 1650, invested: 1500, bought: 1500, income: 0 },
    { date: "2026-01-05", value: 1500, invested: 1300, bought: 1500, income: 10 },
  ];
  const flows = R.toDailyFlows(pts);
  v("returns.toDailyFlows.basic", "toDailyFlows", { points: pts }, flows, "outflow = Δ(bought - invested); income = Δincome; inflow = Δbought.");
  v("returns.computeDailyReturns.basic", "computeDailyReturns", { baseValue: 0, flows }, R.computeDailyReturns(0, flows), "Day with previous value>1e-6: (V + out + inc - in - Vprev)/Vprev. First day with nothing invested: (V + out + inc - in)/in. Flows assumed end-of-day.");
  v("returns.computeTwrSeries.basic", "computeTwrSeries", { baseValue: 0, flows }, R.computeTwrSeries(0, flows));
  v("returns.annualize.halfYear", "annualize", { periodReturn: 0.05, days: 182 }, R.annualize(0.05, 182));
  v("returns.annualize.total-loss", "annualize", { periodReturn: -1, days: 400 }, R.annualize(-1, 400), "periodReturn <= -1 or days <= 0 → null.");
  v("returns.daysBetween.dst", "daysBetween", { fromKey: "2026-03-01", toKey: "2026-04-01" }, R.daysBetween("2026-03-01", "2026-04-01"), "Calendar days, rounded (robust to DST).");
  const cf1: R.CashFlow[] = [{ date: "2025-01-01", amount: -1000 }, { date: "2026-01-01", amount: 1100 }];
  v("returns.xirrDaily.oneYear10pct", "xirrDaily", { flows: cf1 }, R.xirrDaily(cf1), "Daily rate: (1.1)^(1/365)-1. Bisection on log daily rate, 200 iterations, bound min(1, 500/spanDays).");
  v("returns.moneyWeightedReturn.oneYear10pct", "moneyWeightedReturn", { flows: cf1, days: 365 }, R.moneyWeightedReturn(cf1, 365));
  const cf2: R.CashFlow[] = [{ date: "2025-01-01", amount: -1000 }, { date: "2025-07-01", amount: -1000 }, { date: "2025-12-31", amount: 2150 }];
  v("returns.moneyWeightedReturn.twoDeposits", "moneyWeightedReturn", { flows: cf2, days: 364 }, R.moneyWeightedReturn(cf2, 364));
  v("returns.xirrDaily.noSignChange", "xirrDaily", { flows: [{ date: "2025-01-01", amount: -1000 }, { date: "2025-02-01", amount: -10 }] }, R.xirrDaily([{ date: "2025-01-01", amount: -1000 }, { date: "2025-02-01", amount: -10 }]));
  v("returns.investorCashFlows.basic", "investorCashFlows", { baseDate: "2026-01-01", baseValue: 0, flows, endValue: 1500 }, R.investorCashFlows("2026-01-01", 0, flows, 1500));
  const infl: R.InflationPoint[] = [{ month: "2025-01", value: 120 }, { month: "2025-06", value: 121.2 }, { month: "2025-12", value: 123 }];
  v("returns.inflationBetween.basic", "inflationBetween", { points: infl, fromKey: "2025-01-15", toKey: "2026-02-10" }, R.inflationBetween(infl, "2025-01-15", "2026-02-10"), "Start month must exist exactly; end = latest month ≤ toKey month.");
  v("returns.inflationBetween.missingStart", "inflationBetween", { points: infl, fromKey: "2025-02-15", toKey: "2026-02-10" }, R.inflationBetween(infl, "2025-02-15", "2026-02-10"));
  v("returns.realReturn.basic", "realReturn", { nominal: 0.08, inflation: 0.025 }, R.realReturn(0.08, 0.025));
  const bPrices: Record<string, number> = { "2026-01-01": 50, "2026-01-02": 50, "2026-01-03": 52, "2026-01-04": 51, "2026-01-05": 53 };
  v("returns.simulateBenchmark.basic", "simulateBenchmark", { baseDate: "2026-01-01", baseValue: 0, flows, benchmarkPrices: bPrices }, R.simulateBenchmark("2026-01-01", 0, flows, (k) => bPrices[k] ?? null), "priceAt(date) = benchmark price in user currency (last on or before). Buys inflow/price units, sells (outflow+income)/price units at the day's close.");

  // performance range
  n = 0;
  const pTx = [tx("E", "acquisto", "2026-02-10", 1, 100)];
  v("returns.resolvePerformanceRange.3mesiClampedToFirstOp", "resolvePerformanceRange", { transactions: pTx, period: "3mesi", today: "2026-04-15" }, PR.resolvePerformanceRange(pTx, "3mesi", d("2026-04-15")), "today is a local calendar date. 3 months back = 2026-01-15 but clamped to first transaction; baseKey = fromKey - 1 day.");
  v("returns.resolvePerformanceRange.1mese", "resolvePerformanceRange", { transactions: pTx, period: "1mese", today: "2026-04-15" }, PR.resolvePerformanceRange(pTx, "1mese", d("2026-04-15")));
  v("returns.resolvePerformanceRange.customRange", "resolvePerformanceRange", { transactions: pTx, period: "max", today: "2026-04-15", range: { from: "2026-03-01", to: "2026-12-31" } }, PR.resolvePerformanceRange(pTx, "max", d("2026-04-15"), { from: "2026-03-01", to: "2026-12-31" }), "range.to beyond today is clamped to today.");

  // End-to-end portfolio returns
  n = 0;
  const instE = inst("E", "etf");
  const eTx = [tx("E", "acquisto", "2026-01-02", 10, 100), tx("E", "acquisto", "2026-01-05", 10, 105), tx("E", "vendita", "2026-01-08", 5, 108, { fees: 1 })];
  const ePrices: I.PriceInput[] = [["2026-01-02", 100], ["2026-01-03", 102], ["2026-01-05", 105], ["2026-01-06", 103], ["2026-01-07", 106], ["2026-01-08", 108], ["2026-01-09", 107]].map(([date, close]) => ({ instrumentId: "E", date: String(date), close: String(close), source: "yahoo" as const }));
  const params = { transactions: eTx, instruments: [instE], priceIndex: I.buildPriceIndex(ePrices, [], eTx), fx: new Map() as FX.FxTable, userCurrency: "EUR", period: "max" as const, today: d("2026-01-10") };
  const pr = R.computePortfolioReturns(params)!;
  v("returns.computePortfolioReturns.endToEnd", "computePortfolioReturns", { transactions: eTx, instruments: [instE], prices: ePrices, priceIndexBuiltWithTransactions: true, fxRates: [], userCurrency: "EUR", period: "max", today: "2026-01-10", benchmark: null, inflation: null }, { fromKey: pr.fromKey, baseKey: pr.baseKey, toKey: pr.toKey, days: pr.days, showAnnual: pr.showAnnual, twr: pr.twr, twrAnnual: pr.twrAnnual, moneyWeighted: pr.moneyWeighted, moneyWeightedAnnual: pr.moneyWeightedAnnual, daily: pr.daily }, "Subset of fields (series labels are locale-formatted and checked in UI tests). days counted from fromKey when base value is 0.");
  const pg = PG.computePeriodGain(params);
  v("returns.computePeriodGain.endToEnd", "computePeriodGain", "same inputs as returns.computePortfolioReturns.endToEnd", pg, "gain = Σ daily gains = endValue - startValue - netContributions + income.");

  // Heatmap
  v("returns.heatmapLevel.flat", "heatmapLevel", { ret: 0.0004, scale: 0.01 }, H.heatmapLevel(0.0004, 0.01), "|ret| < 0.0005 → level 0.");
  v("returns.heatmapLevel.mid", "heatmapLevel", { ret: -0.006, scale: 0.01 }, H.heatmapLevel(-0.006, 0.01), "ceil(|ret|/scale*4) clamped to [1,4].");
  v("returns.heatmapLevel.saturated", "heatmapLevel", { ret: 0.05, scale: 0.01 }, H.heatmapLevel(0.05, 0.01));
  v("returns.isoWeek.yearBoundary", "isoWeek", { date: "2027-01-01" }, H.isoWeek(d("2027-01-01")), "ISO-8601 week (Thursday rule): Friday 2027-01-01 belongs to 2026-W53 (2026 has 53 weeks).");
  v("returns.isoWeek.mondayNextYear", "isoWeek", { date: "2025-12-29" }, H.isoWeek(d("2025-12-29")), "Monday 2025-12-29 belongs to ISO week 2026-W01.");
  const hDaily: R.DailyReturn[] = [
    { date: "2025-12-30", ret: 0.01, gain: 10 }, { date: "2025-12-31", ret: -0.02, gain: -20 },
    { date: "2026-01-02", ret: 0.03, gain: 30 }, { date: "2026-01-05", ret: null, gain: 0 }, { date: "2026-02-03", ret: 0.0002, gain: 0.2 }, { date: "2026-03-10", ret: -0.05, gain: -50 },
  ];
  const hm = H.buildReturnHeatmap(hDaily, "mese", "2026-03-31")!;
  v("returns.buildReturnHeatmap.month", "buildReturnHeatmap", { daily: hDaily, grouping: "mese", todayKey: "2026-03-31", language: "it" }, { scale: hm.scale, positive: hm.positive, negative: hm.negative, counted: hm.counted, rows: hm.rows.map((r) => ({ label: r.label, cells: r.cells.map((c) => (c ? { key: c.key, ret: c.ret, gain: c.gain, level: c.level } : null)), total: r.total ? { key: r.total.key, ret: r.total.ret, gain: r.total.gain, level: r.total.level } : null })) }, "Cells compound daily returns: Π(1+r)-1; scale = 90th percentile (floor index) of |ret| of non-flat cells; level computed for cells and year totals. Labels omitted (localized).");
}

// =============== risk.json ===============
{
  const v = file("risk", "risk", "lib/calc/risk.ts, lib/calc/risk-extras.ts, lib/investments/title-stats.ts");
  const x = [0.01, -0.02, 0.015, 0.003, -0.007, 0.012];
  const y = [0.008, -0.015, 0.01, 0.002, -0.004, 0.01];
  v("risk.sampleStd.basic", "sampleStd", { values: x }, RK.sampleStd(x), "n-1 denominator.");
  v("risk.sampleStd.single", "sampleStd", { values: [0.01] }, RK.sampleStd([0.01]));
  v("risk.correlation.basic", "correlation", { x, y }, RK.correlation(x, y), "Pearson, clamped to [-1,1]; null if <2 pairs or a series has zero std.");
  v("risk.correlation.flat", "correlation", { x, y: [0, 0, 0, 0, 0, 0] }, RK.correlation(x, [0, 0, 0, 0, 0, 0]));
  v("risk.beta.basic", "beta", { x, y }, RK.beta(x, y), "cov(x,y)/var(y), both sample (n-1).");
  v("risk.observationsPerYear.equities", "observationsPerYear", { observations: 252, calendarDays: 365 }, RK.observationsPerYear(252, 365));
  v("risk.observationsPerYear.empty", "observationsPerYear", { observations: 0, calendarDays: 10 }, RK.observationsPerYear(0, 10));
  const dr: R.DailyReturn[] = [{ date: "2026-01-02", ret: 0.01, gain: 1 }, { date: "2026-01-03", ret: 0, gain: 0 }, { date: "2026-01-04", ret: 0.002, gain: 0 }, { date: "2026-01-05", ret: null, gain: 0 }, { date: "2026-01-06", ret: 0, gain: 0 }];
  v("risk.riskObservations.dropFlatWeekends", "riskObservations", { daily: dr }, RK.riskObservations(dr), "2026-01-03 is Saturday with ret 0 → dropped; Sunday 01-04 moved → kept; null dropped; weekday zero kept.");
  const ddDaily: R.DailyReturn[] = [0.1, -0.2, 0.05, 0.2, -0.1].map((ret, i) => ({ date: `2026-02-0${i + 1}`, ret, gain: 0 }));
  v("risk.computeDrawdown.recovery", "computeDrawdown", { baseKey: "2026-01-31", daily: ddDaily }, RK.computeDrawdown("2026-01-31", ddDaily), "On the TWR index (not on value). recoveryDate = first day index ≥ previous peak.");
  v("risk.sharpeRatio.basic", "sharpeRatio", { returns: x, perYear: 252, annualRiskFree: 0.03 }, RK.sharpeRatio(x, 252, 0.03), "((mean - rf/perYear)/std) * sqrt(perYear).");
  const rates: RK.RateInput[] = [{ date: "2026-01-01", rate: 0.02 }, { date: "2026-01-04", rate: 0.025 }];
  v("risk.averageRate.basic", "averageRate", { rates, dates: ["2025-12-31", "2026-01-02", "2026-01-05"] }, RK.averageRate(rates, ["2025-12-31", "2026-01-02", "2026-01-05"]), "Dates without a prior rate are skipped.");
  const pa = new Map<string, number>(); const pb = new Map<string, number>();
  for (let i = 0; i < 25; i++) { const k = `2026-03-${String(i + 1).padStart(2, "0")}`; pa.set(k, 100 + Math.sin(i) * 3 + i * 0.1); if (i !== 7) pb.set(k, 50 + Math.sin(i + 0.3) * 1.5); }
  v("risk.pairCorrelation.commonDays", "pairCorrelation", { a: Object.fromEntries(pa), b: Object.fromEntries(pb) }, RK.pairCorrelation(pa, pb), "Returns computed only between consecutive COMMON dates; needs ≥20 return pairs.");
  v("risk.sortinoRatio.basic", "sortinoRatio", { returns: x, perYear: 252, annualRiskFree: 0 }, RX.sortinoRatio(x, 252, 0), "Downside deviation divides by n (not n-1).");
  v("risk.calmarRatio.basic", "calmarRatio", { annualReturn: 0.12, maxDrawdown: 0.3 }, RX.calmarRatio(0.12, 0.3));
  const tail = Array.from({ length: 100 }, (_, i) => (i - 50) / 1000);
  v("risk.historicalTailRisk.100", "historicalTailRisk", { returns: "[(i-50)/1000 for i in 0..99]", confidence: 0.95 }, RX.historicalTailRisk(tail), "cut = max(1, floor(n*(1-c))); VaR = -sorted[cut-1]; CVaR = -mean(sorted[0..cut)).");
  v("risk.historicalTailRisk.tooFew", "historicalTailRisk", { returns: x }, RX.historicalTailRisk(x));
  const rc = [{ id: "a", weight: 0.6, returns: Array.from({ length: 60 }, (_, i) => Math.sin(i) / 100) }, { id: "b", weight: 0.4, returns: Array.from({ length: 60 }, (_, i) => Math.cos(i * 1.3) / 200) }];
  v("risk.riskContributions.twoAssets", "riskContributions", { items: "a: weight 0.6, returns sin(i)/100 for i=0..59; b: weight 0.4, returns cos(1.3 i)/200 for i=0..59" }, RX.riskContributions(rc));
  v("risk.concentration.basic", "concentration", { weights: [50, 30, 20] }, RX.concentration([50, 30, 20]));
  v("risk.annualizedReturn.basic", "annualizedReturn", { returns: x, perYear: 252 }, RX.annualizedReturn(x, 252));

  // title stats
  const closes: TS.CloseInput[] = [];
  for (let i = 0; i <= 400; i += 3) {
    const dt = new Date(Date.UTC(2025, 8, 1) + i * 86400000).toISOString().slice(0, 10);
    closes.push({ date: dt, close: Number((100 + i * 0.05 + Math.sin(i / 10) * 4).toFixed(4)) });
  }
  v("risk.computeTitleStats.synthetic", "computeTitleStats", { closes: "every 3 days from 2025-09-01 for i=0..400 step 3: date=2025-09-01+i days (UTC), close=round4(100 + 0.05 i + 4 sin(i/10))", today: closes.at(-1)!.date }, TS.computeTitleStats(closes, closes.at(-1)!.date), "Start close may be up to 10 days before the target date, else period omitted. YTD starts from last close on/before Dec 31 of previous year. 52w window = last.date - 365 days. Volatility needs > 20 closes in the window.");
  v("risk.computeTitleStats.empty", "computeTitleStats", { closes: [], today: "2026-10-18" }, TS.computeTitleStats([], "2026-10-18"));
  v("risk.downsampleCloses.basic", "downsampleCloses", { points: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], maxPoints: 4 }, TS.downsampleCloses([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 4), "index = round(i * (n-1)/(max-1)); JS Math.round is half-up toward +∞.");
}

// =============== costs.json ===============
{
  const v = file("costs", "costs", "lib/calc/costs.ts, lib/investments/cost-impact.ts");
  const pos: C.CostPosition[] = [{ id: "e", name: "ETF", value: 10000, ter: 0.002, subjectToBollo: true }, { id: "s", name: "Stock", value: 5000, ter: null, subjectToBollo: true }, { id: "c", name: "BTC", value: 2000, ter: null, subjectToBollo: false }, { id: "z", name: "Zero", value: 0, ter: 0.01, subjectToBollo: true }];
  v("costs.summarizeCosts.IT", "summarizeCosts", { positions: pos, productCountry: "IT" }, C.summarizeCosts(pos, "IT"), "IT bollo 0.2% on positions subjectToBollo; positions value<=0 dropped; missingTerValue counts ter===null.");
  v("costs.summarizeCosts.DE", "summarizeCosts", { positions: pos, productCountry: "DE" }, C.summarizeCosts(pos, "DE"), "DE annualStampDutyRate = 0.");
  v("costs.costDrag.basic", "costDrag", { value: 10000, grossReturn: 0.06, annualCostPct: 0.004, years: 3 }, C.costDrag(10000, 0.06, 0.004, 3), "withCosts uses (1 + r - c)^year (arithmetic subtraction, not (1+r)(1-c)).");
  v("costs.costDrag.zeroYears", "costDrag", { value: 500, grossReturn: 0.05, annualCostPct: 0.01, years: 0 }, C.costDrag(500, 0.05, 0.01, 0));

  // cost impact end to end
  n = 0;
  const instE = inst("E", "etf");
  const eTx = [tx("E", "acquisto", "2026-01-02", 10, 100, { fees: 5 }), tx("E", "vendita", "2026-01-05", 5, 110, { fees: 2, taxes: 10 })];
  const ePrices: I.PriceInput[] = [["2026-01-02", 100], ["2026-01-03", 102], ["2026-01-04", 104], ["2026-01-05", 110], ["2026-01-06", 115]].map(([date, close]) => ({ instrumentId: "E", date: String(date), close: String(close), source: "yahoo" as const }));
  const params = { transactions: eTx, instruments: [instE], priceIndex: I.buildPriceIndex(ePrices, [], eTx), fx: new Map() as FX.FxTable, userCurrency: "EUR", period: "max" as const, today: d("2026-01-06") };
  const impact = CI.computeCostImpact(params, false, null);
  v("costs.computeCostImpact.noTaxReport", "computeCostImpact", { transactions: eTx, instruments: [instE], prices: ePrices, priceIndexBuiltWithTransactions: true, fxRates: [], userCurrency: "EUR", today: "2026-01-06", unpriced: false, report: null }, impact, "Charges paid on day t are added at day t's close after compounding previous savings by (1 + ret_t). ret null → growth 1.");
  v("costs.reinvestedAmount.feesOnly", "reinvestedAmount", { impact: "output of costs.computeCostImpact.noTaxReport", dateKey: "2026-01-06", includeFees: false, includeTaxes: true }, CI.reinvestedAmount(impact, "2026-01-06", false, true), "include*=true means the cost stays deducted (real); false means 'pretend it stayed invested' → add it.");
  v("costs.reinvestmentEffects.basic", "reinvestmentEffects", { impact: "output of costs.computeCostImpact.noTaxReport" }, CI.reinvestmentEffects(impact));
}

// =============== exposure.json ===============
{
  const v = file("exposure", "exposure-allocation-overlap", "lib/investments/exposure.ts, lib/investments/allocation.ts, lib/investments/overlap.ts, lib/investments/exposure-keys.ts, lib/investments/index-profiles.ts");
  const isS = (k: string): k is string => ["tecnologia", "finanza", "obbligazioni", "non_classificato"].includes(k);
  v("exposure.completeWeights.remainderUnclassified", "completeWeights", { weights: { tecnologia: 0.5, finanza: 0.3, foo: 0.1, obbligazioni: -0.1 } }, EXP.completeWeights({ tecnologia: 0.5, finanza: 0.3, foo: 0.1, obbligazioni: -0.1 }, isS), "Unknown keys and values ≤1e-6 dropped; remainder → non_classificato.");
  v("exposure.completeWeights.rescale", "completeWeights", { weights: { tecnologia: 0.6, finanza: 0.6 } }, EXP.completeWeights({ tecnologia: 0.6, finanza: 0.6 }, isS), "Sum > 1 → rescaled to 1.");
  v("exposure.resolveInstrumentExposure.allWorldEtf", "resolveInstrumentExposure", { instrument: { id: "v", name: "Vanguard FTSE All-World UCITS ETF", type: "etf", isin: "IE00BK5BQT80" }, profile: null, manual: null }, EXP.resolveInstrumentExposure({ id: "v", name: "Vanguard FTSE All-World UCITS ETF", type: "etf", isin: "IE00BK5BQT80" }, null, null), "Index profile estimated from name (table in index-profiles.ts must be shipped as data).");
  v("exposure.resolveInstrumentExposure.stockIsin", "resolveInstrumentExposure", { instrument: { id: "s", name: "Enel", type: "azione", isin: "IT0003128367" }, profile: null, manual: null }, EXP.resolveInstrumentExposure({ id: "s", name: "Enel", type: "azione", isin: "IT0003128367" }, null, null));
  v("exposure.resolveInstrumentExposure.crypto", "resolveInstrumentExposure", { instrument: { id: "k", name: "Bitcoin", type: "crypto", isin: null }, profile: null, manual: null }, EXP.resolveInstrumentExposure({ id: "k", name: "Bitcoin", type: "crypto", isin: null }, null, null));
  const exps = new Map([["v", EXP.resolveInstrumentExposure({ id: "v", name: "Vanguard FTSE All-World UCITS ETF", type: "etf", isin: null }, null, null)], ["s", EXP.resolveInstrumentExposure({ id: "s", name: "Enel", type: "azione", isin: "IT0003128367" }, null, null)]]);
  v("exposure.aggregateExposure.areas", "aggregateExposure", { positions: [{ instrumentId: "v", value: 8000 }, { instrumentId: "s", value: 2000 }, { instrumentId: "u", value: 1000 }], exposures: "v = All-World ETF exposure, s = Enel stock exposure (from vectors above); u has none", dimension: "areas" }, EXP.aggregateExposure([{ instrumentId: "v", value: 8000 }, { instrumentId: "s", value: 2000 }, { instrumentId: "u", value: 1000 }], exps, "areas"), "Instruments without exposure count as 100% non_classificato, which is always sorted last.");

  const pos = [{ instrumentId: "a", value: 6000 }, { instrumentId: "b", value: 3000 }, { instrumentId: "c", value: 1000 }, { instrumentId: "d", value: null }];
  const targets = [{ instrumentId: "a", weight: 0.5 }, { instrumentId: "b", weight: 0.3 }, { instrumentId: "c", weight: 0.2 }];
  const an = AL.analyzeAllocation(pos, targets);
  v("exposure.analyzeAllocation.basic", "analyzeAllocation", { positions: pos, targets }, an, "Tolerance ±5 points → in_linea. Sorted by drift ascending.");
  v("exposure.suggestContribution.waterFill", "suggestContribution", { analysis: "output of exposure.analyzeAllocation.basic", amount: 2000 }, AL.suggestContribution(an, 2000), "Water-filling: buys that are < 10% of amount are dropped and amount redistributed.");
  v("exposure.suggestContribution.smallDropped", "suggestContribution", { analysis: "output of exposure.analyzeAllocation.basic", amount: 500 }, AL.suggestContribution(an, 500));
  v("exposure.roundedCurrentWeights.sumTo100", "roundedCurrentWeights", { positions: [{ instrumentId: "a", value: 1 }, { instrumentId: "b", value: 1 }, { instrumentId: "c", value: 1 }] }, AL.roundedCurrentWeights([{ instrumentId: "a", value: 1 }, { instrumentId: "b", value: 1 }, { instrumentId: "c", value: 1 }]), "Rounding remainder goes to the largest (first after sort by percent desc; stable).");
  v("exposure.isCompleteTarget.true", "isCompleteTarget", { targets }, AL.isCompleteTarget(targets));
  v("exposure.normalizeCompanyName.basic", "normalizeCompanyName", { name: "Apple Inc. Class A" }, OV.normalizeCompanyName("Apple Inc. Class A"));
  v("exposure.baseTicker.basic", "baseTicker", { symbol: "enel.mi" }, OV.baseTicker("enel.mi"));
  const ha = [{ symbol: "AAPL", name: "Apple Inc", weight: 0.05 }, { symbol: "MSFT", name: "Microsoft Corp", weight: 0.045 }, { symbol: "NVDA", name: "NVIDIA Corp", weight: 0.04 }];
  const hb = [{ symbol: "AAPL.US", name: "Apple", weight: 0.07 }, { symbol: null, name: "Microsoft Corporation", weight: 0.06 }, { symbol: "AMZN", name: "Amazon.com Inc", weight: 0.03 }];
  v("exposure.holdingsOverlap.basic", "holdingsOverlap", { a: ha, b: hb }, OV.holdingsOverlap(ha as never, hb as never), "Match by base ticker or normalized name; sum of min weights.");
}

for (const [name, content] of Object.entries(files)) writeFileSync(`${outDir}/${name}.json`, JSON.stringify(content, null, 2) + "\n");
console.log(Object.entries(files).map(([k, f]) => `${k}: ${f.vectors.length}`).join("\n"));
