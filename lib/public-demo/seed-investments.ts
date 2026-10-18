/**
 * Investments of the sample account (`seed.ts`): a varied portfolio that exercises every investment screen. ETFs
 * (global, S&P 500, emerging, dividend, bonds), single stocks in EUR, USD and CHF held at a second broker, a
 * government bond with coupons, a zero-coupon bill already redeemed, gold, a crypto, a fund priced by hand, a closed
 * position at a loss, a watchlist with price alerts, a benchmark and a target allocation. Securities carry real names
 * (so the screens show the brands people know) but invented ISINs and invented daily prices (fixed-seed random walks)
 * that start and end near the real closes of mid-August 2025 and 16 October 2026 (`REAL_CLOSES`): never fetched, the
 * price cron skips demo instruments (`lib/market-data/store.ts`). Over time the demo drifts from the market; refresh
 * `REAL_CLOSES` when that shows. Government bonds and the hand-priced fund stay generic. Italy and Germany get the same
 * shape with their own bonds, broker and dividend taxes.
 */
import { and, desc, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { brokerImportAccounts } from "@/lib/db/schema/broker-import-accounts";
import {
  fxRates,
  instrumentPrices,
  instrumentProfiles,
  instruments,
  investmentPortfolios,
  investmentTargets,
  investmentTaxCarryforwards,
  investmentTransactions,
  userInstrumentBreakdowns,
  userInstrumentPrices,
  userInstrumentSettings,
  userPriceAlerts,
  userWatchlistItems,
} from "@/lib/db/schema/investments";
import { couponDates } from "@/lib/investments/dividends";
import type { ProductCountry } from "@/lib/localization/config";

/** Invented ISINs of the demo securities (never real ones, even for real names), also used to clean up orphans of older seeds. */
export const DEMO_ISINS = [
  "IE00DEMO0001", "IT00DEMO0002", "IT00DEMO0003", "IT00DEMO0004", "IE00DEMO0005", "IE00DEMO0006", "IE00DEMO0007",
  "IE00DEMO0008", "US00DEMO0009", "US00DEMO0010", "CH00DEMO0011", "JE00DEMO0012", "IT00DEMO0013", "IT00DEMO0014",
  "IE00DEMO0015", "IT00DEMO0016", "US00DEMO0016", "DE00DEMO0003", "DE00DEMO0013", "DE00DEMO0014",
];
/** Days of invented prices: a little more than a year, so last year's sale and the 12-month windows have data. */
const PRICE_DAYS = 430;
/** Seed of the new positions' prices, separate from the main generator so the older demo figures stay the same. */
const INVESTMENTS_SEED = 20261018;

/**
 * Real closes the invented prices start from (about 430 days back) and end on (today), in the instrument's currency:
 * ETFs from justETF (EUR, Xetra), US stocks from Nasdaq, Ferrari and SAP from their US listing at the ECB rate,
 * Nestlé and Bitcoin rounded. Start: 15 August 2025; end: 16 October 2026.
 */
const REAL_CLOSES = {
  allWorld: [135.69, 170.38],
  sp500: [588.94, 740.44],
  emerging: [58.31, 78.52],
  highDividend: [65.69, 82.1],
  euroGovBonds: [109.67, 105.17],
  gold: [55.42, 72.01],
  msciWorld: [104.68, 130.48],
  apple: [231.59, 343.46],
  nike: [76.97, 37.13],
  nvidia: [180.45, 214.13],
  ferrari: [394.04, 353.27],
  sap: [237.72, 199.32],
  nestle: [77, 82.43],
  bitcoin: [100300, 72456],
  usdPerEur: [1.1688, 1.1253],
  chfPerEur: [0.9418, 0.9272],
} as const;
/** Maturity of the demo government bond: coupons are counted back from here, every six months. */
const BOND_MATURITY = "2030-08-15";

/** Tax on dividends after the foreign withholding: Italy 26% on the net, Germany 26.375% less the credited 15%. */
const DOMESTIC_DIVIDEND_TAX: Record<ProductCountry, { rate: number; creditedForeign: number | null }> = {
  IT: { rate: 0.26, creditedForeign: null },
  DE: { rate: 0.26375, creditedForeign: 0.15 },
};

/** Per-country parts of the portfolio: second broker, bonds and the hand-priced fund. */
const COUNTRY_PARTS: Record<ProductCountry, { broker: string; brokerCash: string; accountKey: string; bond: { isin: string; name: string; taxRate?: string }; bill: { isin: string; name: string; taxRate?: string }; fund: { isin: string; name: string } }> = {
  IT: {
    broker: "interactive-brokers",
    brokerCash: "Interactive Brokers · liquidità",
    accountKey: "U0000DEMO",
    bond: { isin: "IT00DEMO0003", name: "BTP Valore 2030", taxRate: "0.1250" },
    bill: { isin: "IT00DEMO0013", name: "BOT 12 mesi", taxRate: "0.1250" },
    fund: { isin: "IT00DEMO0014", name: "Fondo Bilanciato" },
  },
  DE: {
    broker: "trade-republic",
    brokerCash: "Trade Republic · liquidità",
    accountKey: "TR-DEMO",
    bond: { isin: "DE00DEMO0003", name: "Bund tedesco 2030" },
    bill: { isin: "DE00DEMO0013", name: "Titolo di Stato tedesco 12 mesi" },
    fund: { isin: "DE00DEMO0014", name: "Fondo Misto" },
  },
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** mulberry32 pseudo-random generator: the same numbers on every run. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SeedDemoInvestmentsOptions {
  userId: string;
  productCountry: ProductCountry;
  /** Translates a demo text into the account's language (`demoText`). */
  text: (source: string) => string;
  /** Generator of the main seed: the four original securities keep drawing from it, in the same order. */
  rand: () => number;
  today: Date;
}

export interface SeedDemoInvestmentsResult {
  /** The global ETF, which partly funds a savings goal. */
  globalEtfId: string;
  operations: number;
  prices: number;
}

/** Creates the demo portfolio, its prices and everything around it (watchlist, alerts, targets). */
export async function seedDemoInvestments({ userId, productCountry, text, rand, today }: SeedDemoInvestmentsOptions): Promise<SeedDemoInvestmentsResult> {
  const parts = COUNTRY_PARTS[productCountry];
  const r = rng(INVESTMENTS_SEED);
  const daysAgo = (n: number) => new Date(today.getTime() - n * 86400000);
  const dateAgo = (n: number) => iso(daysAgo(n));
  const dividendTax = (grossEur: number, foreignWithholding: number) => {
    const domestic = DOMESTIC_DIVIDEND_TAX[productCountry];
    const local = domestic.creditedForeign === null ? (1 - foreignWithholding) * domestic.rate : Math.max(0, domestic.rate - Math.min(foreignWithholding, domestic.creditedForeign));
    return round2(grossEur * (foreignWithholding + local));
  };

  // Exchange rates: real ones come from the ECB cron. Only an empty database (screenshots, a fresh self-hosted demo)
  // gets invented ones, never mixed with real rows.
  const fx = { USD: shaped(r, ...REAL_CLOSES.usdPerEur, 0.004), CHF: shaped(r, ...REAL_CLOSES.chfPerEur, 0.003) };
  for (const [currency, values] of Object.entries(fx)) {
    const [existing] = await db.select({ id: fxRates.id }).from(fxRates).where(eq(fxRates.currency, currency)).limit(1);
    if (existing) continue;
    const rows = values.map((perEur, i) => ({ date: dateAgo(PRICE_DAYS - 1 - i), currency, perEur: perEur.toFixed(6), source: "ecb" as const }));
    for (let i = 0; i < rows.length; i += 500) await db.insert(fxRates).values(rows.slice(i, i + 500)).onConflictDoNothing();
  }
  // Rates as the app will read them (real when present), for the operations' exchange rate.
  const fxOn = async (currency: "USD" | "CHF", back: number) => {
    const [row] = await db
      .select({ perEur: fxRates.perEur })
      .from(fxRates)
      .where(and(eq(fxRates.currency, currency), lte(fxRates.date, dateAgo(back))))
      .orderBy(desc(fxRates.date))
      .limit(1);
    return row ? Number(row.perEur) : fx[currency][PRICE_DAYS - 1 - back];
  };

  const [portfolio] = await db
    .insert(investmentPortfolios)
    .values({ userId, name: text("Portafoglio principale"), broker: "Broker Demo", taxRegime: "amministrato" })
    .returning();
  // Second broker, as after a statement import: its operations carry the source, its cash is a separate account.
  const [brokerCash] = await db
    .insert(accounts)
    .values({ userId, name: text(parts.brokerCash), type: "Liquidità broker", balance: "1320.00", icon: "landmark" })
    .returning();
  await db.insert(brokerImportAccounts).values({ userId, accountKey: parts.accountKey, provider: parts.broker, portfolioId: portfolio.id, cashAccountId: brokerCash.id });

  // Owned by the demo user; dividend history marked as already fetched, so the income screen does not try to
  // download it for securities no source knows.
  const own = { createdByUserId: userId, dividendsFetchedAt: new Date() };
  const rows = await db
    .insert(instruments)
    .values([
      // The four original securities, in their original order (their prices come from the main generator).
      { isin: "IE00DEMO0001", name: "Vanguard FTSE All-World UCITS ETF Acc", type: "etf", currency: "EUR", exchange: "XETRA", taxHarmonized: true, ...own },
      { isin: "IT00DEMO0002", name: "Ferrari N.V.", type: "azione", currency: "EUR", exchange: "MIL", ...own },
      { isin: parts.bond.isin, name: text(parts.bond.name), type: "obbligazione", currency: "EUR", priceUnit: "percentuale_nominale", ...(parts.bond.taxRate ? { taxRate: parts.bond.taxRate } : {}), ...own },
      { isin: "IT00DEMO0004", name: "SAP SE", type: "azione", currency: "EUR", exchange: "XETRA", ...own },
      { isin: "IE00DEMO0005", name: "iShares Core S&P 500 UCITS ETF Acc", type: "etf", currency: "EUR", exchange: "XETRA", taxHarmonized: true, ...own },
      { isin: "IE00DEMO0006", name: "Xtrackers MSCI Emerging Markets UCITS ETF 1C", type: "etf", currency: "EUR", exchange: "XETRA", taxHarmonized: true, ...own },
      { isin: "IE00DEMO0007", name: "Vanguard FTSE All-World High Dividend Yield UCITS ETF Dist", type: "etf", currency: "EUR", exchange: "XETRA", taxHarmonized: true, ...own },
      { isin: "IE00DEMO0008", name: "iShares Core € Govt Bond UCITS ETF Dist", type: "etf", currency: "EUR", exchange: "XETRA", taxHarmonized: true, ...own },
      { isin: "US00DEMO0009", name: "Apple Inc.", type: "azione", currency: "USD", exchange: "NASDAQ", ...own },
      { isin: "US00DEMO0010", name: "Nike Inc.", type: "azione", currency: "USD", exchange: "NYSE", ...own },
      { isin: "CH00DEMO0011", name: "Nestlé S.A.", type: "azione", currency: "CHF", exchange: "SIX", ...own },
      { isin: "JE00DEMO0012", name: "iShares Physical Gold ETC", type: "etc", currency: "EUR", exchange: "XETRA", ...own },
      { isin: parts.bill.isin, name: text(parts.bill.name), type: "obbligazione", currency: "EUR", priceUnit: "percentuale_nominale", ...(parts.bill.taxRate ? { taxRate: parts.bill.taxRate } : {}), ...own },
      { isin: parts.fund.isin, name: text(parts.fund.name), type: "fondo", currency: "EUR", priceMode: "manuale", ...own },
      { isin: null, name: "Bitcoin", type: "crypto", currency: "EUR", ...own },
      // Followed, not owned: the benchmark and a stock with a price alert.
      { isin: "IE00DEMO0015", name: "iShares Core MSCI World UCITS ETF Acc", type: "etf", currency: "EUR", exchange: "XETRA", taxHarmonized: true, ...own },
      { isin: "US00DEMO0016", name: "NVIDIA Corporation", type: "azione", currency: "USD", exchange: "NASDAQ", ...own },
    ] satisfies (typeof instruments.$inferInsert)[])
    .returning();
  const [etf, stock, bond, tech, sp500, emerging, dividendEtf, bondEtf, apple, nike, nestle, gold, bill, fund, coin, world, nvidia] = rows;

  // A shared daily market move: equities follow it (each with its own beta), so they rise and fall together like
  // real ones and the correlation and benchmark figures look plausible.
  const market = Array.from({ length: PRICE_DAYS }, () => (r() - 0.5) * 0.018);
  // The last three months (the default chart period) rise by about 4%, whatever the noise drew: the demo opens on
  // an ordinary good quarter, not on a random loss.
  const RECENT_DAYS = 95;
  const recentDrift = (0.04 - market.slice(-RECENT_DAYS).reduce((sum, m) => sum + m, 0)) / RECENT_DAYS;
  for (let i = PRICE_DAYS - RECENT_DAYS; i < PRICE_DAYS; i++) market[i] += recentDrift;
  // Original series: they still draw from the main generator, the same number of times, so the later demo figures
  // (goals, pension) do not move.
  const series = (start: number, drift: number, vol: number, beta = 0) => {
    const out: number[] = [];
    let p = start;
    for (let i = 0; i < PRICE_DAYS; i++) {
      p *= 1 + drift + (rand() - 0.5) * vol * (beta ? 0.6 : 1) + beta * market[i];
      out.push(p);
    }
    return out;
  };
  // A stock falling for the first 50 days (hence last year's realised loss) and then slowly recovering.
  const techSeries = series(30, 0.0006, 0.016, 0.9).map((p, i) => (i < 50 ? 30 * (1 - 0.14 * (i / 50)) : p * 0.86));
  // Same shapes as before, scaled so that today's close is the real one: returns stay the same, prices look right.
  const endingAt = (values: number[], end: number) => values.map((p) => (p * end) / values[values.length - 1]);
  const original = [
    { id: etf.id, s: endingAt(series(88, 0.0004, 0.012, 1), REAL_CLOSES.allWorld[1]) },
    { id: stock.id, s: endingAt(series(21, 0.0007, 0.014, 0.7), REAL_CLOSES.ferrari[1]) },
    { id: bond.id, s: series(99.6, 0.00004, 0.0012) },
    { id: tech.id, s: endingAt(techSeries, REAL_CLOSES.sap[1]) },
  ];
  // Bill bought at 96.9 a year before maturity, pulled to par: no prices after its redemption.
  const billBought = 400;
  const billRedeemed = 35;
  const billSeries = Array.from({ length: PRICE_DAYS }, (_, i) => {
    const back = PRICE_DAYS - 1 - i;
    if (back > billBought || back < billRedeemed) return Number.NaN;
    return 96.9 + 3.1 * ((billBought - back) / (billBought - billRedeemed)) + (r() - 0.5) * 0.04;
  });
  const prices = [
    ...original,
    { id: sp500.id, s: shaped(r, ...REAL_CLOSES.sp500, 0.01, market, 1.05) },
    { id: emerging.id, s: shaped(r, ...REAL_CLOSES.emerging, 0.016, market, 0.9) },
    { id: dividendEtf.id, s: shaped(r, ...REAL_CLOSES.highDividend, 0.01, market, 0.85) },
    { id: bondEtf.id, s: shaped(r, ...REAL_CLOSES.euroGovBonds, 0.004) },
    { id: apple.id, s: shaped(r, ...REAL_CLOSES.apple, 0.028, market, 1.4) },
    // Bad news five months ago: the stock still trades at about half what Giulia paid.
    { id: nike.id, s: shaped(r, REAL_CLOSES.nike[0] / 1.25, REAL_CLOSES.nike[1], 0.026, market, 0.8).map((p, i) => (PRICE_DAYS - 1 - i <= 150 ? p : p * 1.25)) },
    { id: nestle.id, s: shaped(r, ...REAL_CLOSES.nestle, 0.01, market, 0.5) },
    { id: gold.id, s: shaped(r, ...REAL_CLOSES.gold, 0.014) },
    { id: bill.id, s: billSeries },
    { id: coin.id, s: shaped(r, ...REAL_CLOSES.bitcoin, 0.05, market, 1.2) },
    { id: world.id, s: shaped(r, ...REAL_CLOSES.msciWorld, 0.006, market, 1) },
    { id: nvidia.id, s: shaped(r, ...REAL_CLOSES.nvidia, 0.022, market, 1.3) },
  ];
  const priceRows: (typeof instrumentPrices.$inferInsert)[] = [];
  for (const p of prices) {
    p.s.forEach((close, i) => {
      const date = daysAgo(PRICE_DAYS - 1 - i);
      if (!Number.isFinite(close) || date.getUTCDay() === 0 || date.getUTCDay() === 6) return;
      priceRows.push({ instrumentId: p.id, date: iso(date), close: close.toFixed(4), source: "yahoo" });
    });
  }
  for (let i = 0; i < priceRows.length; i += 500) await db.insert(instrumentPrices).values(priceRows.slice(i, i + 500));
  const priceOn = (id: string, back: number) => prices.find((x) => x.id === id)!.s[PRICE_DAYS - 1 - back];

  // The balanced fund publishes its NAV once a month and Giulia types it in (manual prices).
  const fundNav = shaped(r, 10.2, 10.94, 0.003, market, 0.5);
  const navRows: (typeof userInstrumentPrices.$inferInsert)[] = [];
  for (let back = 420; back >= 0; back -= 30) navRows.push({ userId, instrumentId: fund.id, date: dateAgo(back), close: fundNav[PRICE_DAYS - 1 - back].toFixed(4) });
  await db.insert(userInstrumentPrices).values(navRows);
  const navOn = (back: number) => Number(navRows.filter((row) => row.date <= dateAgo(back)).at(-1)!.close);

  const ops: (typeof investmentTransactions.$inferInsert)[] = [];
  const base = { userId, portfolioId: portfolio.id };
  const atBroker = { ...base, statementAccountKey: parts.accountKey };
  const buyFor = (instrumentId: string, back: number, amount: number, fees: string, decimals = 2) => {
    const price = priceOn(instrumentId, back);
    const step = 10 ** decimals;
    ops.push({ ...base, instrumentId, type: "acquisto", date: dateAgo(back), quantity: (Math.floor((amount / price) * step) / step).toFixed(decimals), price: price.toFixed(4), fees });
  };

  // Original operations.
  for (const back of [330, 270, 210, 150, 90, 30]) buyFor(etf.id, back, 3200, "1.50");
  // Whole shares worth about the same as before the securities got real names (and real price levels).
  const sharesFor = (instrumentId: string, back: number, amount: number) => Math.max(1, Math.round(amount / priceOn(instrumentId, back)));
  const stockShares = sharesFor(stock.id, 300, 8000);
  ops.push({ ...base, instrumentId: stock.id, type: "acquisto", date: dateAgo(300), quantity: String(stockShares), price: priceOn(stock.id, 300).toFixed(4), fees: "4.95" });
  const stockDividend = round2(stockShares * 2.99);
  ops.push({ ...base, instrumentId: stock.id, type: "dividendo", date: dateAgo(120), quantity: "0", price: "0", grossAmount: stockDividend.toFixed(2), taxes: dividendTax(stockDividend, 0).toFixed(2) });
  ops.push({ ...base, instrumentId: bond.id, type: "acquisto", date: dateAgo(200), quantity: "10000", price: "99.8000", fees: "0" });
  // Sales: a loss last year (it goes into the zainetto fiscale, tax-loss carryforward) and a gain this year that offsets it.
  const techShares = String(sharesFor(tech.id, 425, 9000));
  ops.push({ ...base, instrumentId: tech.id, type: "acquisto", date: dateAgo(425), quantity: techShares, price: priceOn(tech.id, 425).toFixed(4), fees: "4.95" });
  ops.push({ ...base, instrumentId: tech.id, type: "vendita", date: dateAgo(375), quantity: techShares, price: priceOn(tech.id, 375).toFixed(4), fees: "4.95" });
  ops.push({ ...base, instrumentId: stock.id, type: "vendita", date: dateAgo(45), quantity: String(Math.floor(stockShares / 2)), price: priceOn(stock.id, 45).toFixed(4), fees: "4.95" });

  // Government bond coupons, every six months while held (gross on the nominal, tax at the bond's rate).
  const bondTax = Number(parts.bond.taxRate ?? DOMESTIC_DIVIDEND_TAX[productCountry].rate);
  const coupon = { rate: 0.031, frequency: 2 as const, maturityDate: BOND_MATURITY };
  for (const date of couponDates(coupon, dateAgo(200), dateAgo(0))) {
    const gross = round2((10000 * coupon.rate) / coupon.frequency);
    ops.push({ ...base, instrumentId: bond.id, type: "cedola", date, quantity: "0", price: "0", grossAmount: gross.toFixed(2), taxes: round2(gross * bondTax).toFixed(2) });
  }

  // A monthly S&P 500 plan, €250 at no fee, for a year.
  for (let back = 360; back >= 30; back -= 30) buyFor(sp500.id, back, 250, "0", 4);
  // Emerging markets bought twice, the second time at a higher price: today slightly down.
  buyFor(emerging.id, 250, 1500, "1.50");
  buyFor(emerging.id, 100, 1000, "1.50");
  // A distributing dividend ETF: four quarterly payouts.
  buyFor(dividendEtf.id, 410, 4000, "1.50");
  const dividendUnits = Number(ops.at(-1)!.quantity);
  for (const back of [340, 250, 160, 70]) {
    const gross = round2(dividendUnits * 0.55);
    ops.push({ ...base, instrumentId: dividendEtf.id, type: "dividendo", date: dateAgo(back), quantity: "0", price: "0", grossAmount: gross.toFixed(2), taxes: dividendTax(gross, 0).toFixed(2) });
  }
  buyFor(bondEtf.id, 380, 3000, "1.50");
  buyFor(bondEtf.id, 150, 2000, "1.50");
  buyFor(gold.id, 400, 2500, "1.50");
  buyFor(gold.id, 120, 1000, "1.50");
  // Fund bought once at its NAV; the bill bought and later redeemed at par.
  ops.push({ ...base, instrumentId: fund.id, type: "acquisto", date: dateAgo(415), quantity: (Math.floor((6000 / navOn(415)) * 1000) / 1000).toFixed(3), price: navOn(415).toFixed(4), fees: "0" });
  ops.push({ ...base, instrumentId: bill.id, type: "acquisto", date: dateAgo(billBought), quantity: "5000", price: priceOn(bill.id, billBought).toFixed(4), fees: "0" });
  ops.push({ ...base, instrumentId: bill.id, type: "rimborso", date: dateAgo(billRedeemed), quantity: "5000", price: "100.0000", fees: "0" });
  // Crypto: two buys, then 40% sold on a good day.
  buyFor(coin.id, 300, 800, "2.00", 6);
  buyFor(coin.id, 200, 700, "2.00", 6);
  const coinUnits = ops.filter((o) => o.instrumentId === coin.id).reduce((sum, o) => sum + Number(o.quantity), 0);
  // Sold on the best close of the last two months.
  const coinSaleBack = Array.from({ length: 60 }, (_, i) => i + 5).reduce((best, back) => (priceOn(coin.id, back) > priceOn(coin.id, best) ? back : best));
  ops.push({ ...base, instrumentId: coin.id, type: "vendita", date: dateAgo(coinSaleBack), quantity: (Math.floor(coinUnits * 0.4 * 1e6) / 1e6).toFixed(6), price: priceOn(coin.id, coinSaleBack).toFixed(4), fees: "2.00" });

  // At the second broker, in dollars and francs: operations carry the exchange rate of their day. Amounts are in the
  // security's currency and become whole shares.
  const held: Record<string, number> = {};
  const foreignBuy = async (instrumentId: string, currency: "USD" | "CHF", back: number, amount: number) => {
    const quantity = sharesFor(instrumentId, back, amount);
    held[instrumentId] = (held[instrumentId] ?? 0) + quantity;
    ops.push({ ...atBroker, instrumentId, type: "acquisto", date: dateAgo(back), quantity: String(quantity), price: priceOn(instrumentId, back).toFixed(4), fxRate: (1 / (await fxOn(currency, back))).toFixed(6), fees: "1.00" });
  };
  const foreignSell = async (instrumentId: string, currency: "USD" | "CHF", back: number, quantity: number) => {
    held[instrumentId] -= quantity;
    ops.push({ ...atBroker, instrumentId, type: "vendita", date: dateAgo(back), quantity: String(quantity), price: priceOn(instrumentId, back).toFixed(4), fxRate: (1 / (await fxOn(currency, back))).toFixed(6), fees: "1.00" });
  };
  const foreignDividend = async (instrumentId: string, currency: "USD" | "CHF", back: number, perShare: number, withholding: number) => {
    const fxRate = 1 / (await fxOn(currency, back));
    const gross = round2(held[instrumentId] * perShare);
    ops.push({ ...atBroker, instrumentId, type: "dividendo", date: dateAgo(back), quantity: "0", price: "0", fxRate: fxRate.toFixed(6), grossAmount: gross.toFixed(2), taxes: dividendTax(gross * fxRate, withholding).toFixed(2) });
  };
  // Apple: the big winner, partly sold to take profit; a small quarterly dividend (15% US withholding).
  await foreignBuy(apple.id, "USD", 420, 2800);
  await foreignDividend(apple.id, "USD", 330, 0.26, 0.15);
  await foreignBuy(apple.id, "USD", 260, 1300);
  for (const back of [240, 150]) await foreignDividend(apple.id, "USD", back, 0.26, 0.15);
  await foreignSell(apple.id, "USD", 60, Math.round(held[apple.id] * 0.4));
  await foreignDividend(apple.id, "USD", 20, 0.26, 0.15);
  // Nike: bought, averaged down after the fall, still at a loss; quarterly dividends.
  await foreignBuy(nike.id, "USD", 350, 3000);
  for (const back of [300, 210]) await foreignDividend(nike.id, "USD", back, 0.4, 0.15);
  await foreignBuy(nike.id, "USD", 130, 1000);
  for (const back of [120, 30]) await foreignDividend(nike.id, "USD", back, 0.41, 0.15);
  // Nestlé: a yearly dividend with the 35% Swiss withholding.
  await foreignBuy(nestle.id, "CHF", 390, 2200);
  await foreignDividend(nestle.id, "CHF", 170, 3.05, 0.35);
  await db.insert(investmentTransactions).values(ops);

  // What the sources would say about each security: sector and country of the stocks, mix and top holdings of the
  // funds (the global ETF holds Apple too, so the overlap with the direct position shows). Saved as fetched today.
  const profile = (instrumentId: string, fields: Omit<typeof instrumentProfiles.$inferInsert, "instrumentId" | "source">) => ({ instrumentId, source: "yahoo" as const, ...fields });
  await db.insert(instrumentProfiles).values([
    profile(stock.id, { symbol: "RACE.MI", sector: "consumi_ciclici", country: "IT" }),
    profile(tech.id, { symbol: "SAP.DE", sector: "tecnologia", country: "DE" }),
    profile(apple.id, { symbol: "AAPL", sector: "tecnologia", country: "US" }),
    profile(nike.id, { symbol: "NKE", sector: "consumi_ciclici", country: "US" }),
    profile(nestle.id, { symbol: "NESN.SW", sector: "consumi_difensivi", country: "CH" }),
    profile(nvidia.id, { symbol: "NVDA", sector: "tecnologia", country: "US" }),
    profile(etf.id, {
      symbol: "VWCE.DE",
      assetMix: { stock: 0.995, bond: 0, cash: 0.005, other: 0 },
      sectors: { tecnologia: 0.26, finanza: 0.16, salute: 0.11, industria: 0.11, consumi_ciclici: 0.1, comunicazioni: 0.08, consumi_difensivi: 0.06, energia: 0.04, materiali: 0.04, servizi_pubblici: 0.02, immobiliare: 0.02 },
      holdings: [
        { symbol: "NVDA", name: "NVIDIA Corporation", weight: 0.046 },
        { symbol: "AAPL", name: "Apple Inc.", weight: 0.041 },
        { symbol: "MSFT", name: "Microsoft Corporation", weight: 0.036 },
        { symbol: "AMZN", name: "Amazon.com Inc.", weight: 0.022 },
        { symbol: "GOOGL", name: "Alphabet Inc.", weight: 0.014 },
      ],
    }),
    profile(bondEtf.id, { symbol: "EUNH.DE", assetMix: { stock: 0, bond: 0.985, cash: 0.015, other: 0 } }),
    profile(fund.id, { symbol: null, assetMix: { stock: 0.52, bond: 0.41, cash: 0.07, other: 0 } }),
  ]);
  // Yahoo has no regions for funds: Giulia entered the global ETF's ones by hand.
  await db.insert(userInstrumentBreakdowns).values({ userId, instrumentId: etf.id, areas: { nord_america: 0.68, europa: 0.13, giappone: 0.05, pacifico: 0.04, emergenti: 0.1 } });
  await db.insert(userInstrumentSettings).values({ userId, instrumentId: bond.id, couponRate: coupon.rate.toFixed(6), couponFrequency: coupon.frequency, maturityDate: BOND_MATURITY });

  // Benchmark, target allocation, watchlist and alerts (one waiting, one already triggered).
  await db.update(investmentPortfolios).set({ benchmarkInstrumentId: world.id }).where(eq(investmentPortfolios.id, portfolio.id));
  const targets: [string, number][] = [[etf.id, 0.35], [sp500.id, 0.1], [emerging.id, 0.08], [dividendEtf.id, 0.06], [bondEtf.id, 0.1], [bond.id, 0.12], [fund.id, 0.07], [gold.id, 0.05], [stock.id, 0.03], [apple.id, 0.02], [coin.id, 0.02]];
  await db.insert(investmentTargets).values(targets.map(([instrumentId, weight]) => ({ portfolioId: portfolio.id, instrumentId, weight: weight.toFixed(6) })));
  await db.insert(userWatchlistItems).values([{ userId, instrumentId: world.id }, { userId, instrumentId: nvidia.id }]);
  const triggeredBack = 12;
  const appleThen = priceOn(apple.id, triggeredBack);
  await db.insert(userPriceAlerts).values([
    // Far below today's price, and demo prices never move between rebuilds: it cannot fire.
    { userId, instrumentId: nvidia.id, direction: "sotto", targetPrice: (Math.floor(priceOn(nvidia.id, 0) * 0.8 * 10) / 10).toFixed(2) },
    { userId, instrumentId: apple.id, direction: "sopra", targetPrice: Math.floor(appleThen - 1).toFixed(2), status: "scattato", triggeredAt: daysAgo(triggeredBack), triggeredPrice: appleThen.toFixed(4) },
  ]);
  // Italy: losses from a previous broker, entered by hand (zainetto fiscale), usable until the end of year + 4.
  if (productCountry === "IT") {
    await db.insert(investmentTaxCarryforwards).values({ userId, portfolioId: portfolio.id, year: today.getUTCFullYear() - 2, amount: "640.00", note: text("Minusvalenze dal broker precedente") });
  }

  return { globalEtfId: etf.id, operations: ops.length, prices: priceRows.length };
}

/**
 * Daily series from `start` to exactly `end`: a random walk with daily volatility `vol` plus `beta` times the shared
 * market move, then bent so its last value lands on `end`. The ending is chosen, the path in between is noise.
 */
function shaped(r: () => number, start: number, end: number, vol: number, market: number[] = [], beta = 0): number[] {
  const walk: number[] = [];
  let p = 1;
  for (let i = 0; i < PRICE_DAYS; i++) {
    p *= 1 + (r() - 0.5) * vol + beta * (market[i] ?? 0);
    walk.push(p);
  }
  const last = walk[PRICE_DAYS - 1];
  return walk.map((w, i) => start * w * (end / start / last) ** (i / (PRICE_DAYS - 1)));
}
