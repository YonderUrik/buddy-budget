import { buildFxTable } from "@/lib/calc/fx";
import { forecastIncome, incomeByMonth } from "@/lib/investments/dividends";
import type { InvestmentData } from "@/lib/investments/data";
import { germanCapitalTax, fundTaxableShare } from "./countries/de";
import { germanPortfolioReport } from "./portfolio";
import type { TaxProfile } from "./schema";

/** Gross schedule uses shared dividend mechanics; German net is incremental annual tax, never a flat Italian rate. */
export function germanIncomeForecast(data: InvestmentData, profile: TaxProfile, today: string) {
  const raw = forecastIncome({ transactions: data.transactions, instruments: data.instruments,
    taxInstruments: data.instruments.map(i => ({ ...i, taxRate: 0, harmonized: true })), settings: data.instrumentSettings,
    dividends: data.dividends, fx: buildFxTable(data.fxRates), userCurrency: data.currency, todayKey: today });
  const report = germanPortfolioReport(data, profile, today);
  let general = report.generalIncome;
  let previousTax = report.estimate?.total ?? 0;
  let canEstimate = report.estimate !== null;
  const instruments = new Map(data.instruments.map(i => [i.id, i]));
  const events = raw.events.filter(e => e.kind !== "rimborso").map(e => {
    const instrument = instruments.get(e.instrumentId);
    const fund = instrument?.type === "etf" || instrument?.type === "fondo";
    const fraction = fund ? fundTaxableShare(profile.fundKinds[e.instrumentId] ?? "unknown") : 1;
    const eligible = instrument && ["azione", "obbligazione", "etf", "fondo"].includes(instrument.type);
    if (fraction === null || !eligible || Number(e.date.slice(0, 4)) !== profile.year) canEstimate = false;
    let net: number | null = null;
    if (canEstimate && fraction !== null) {
      general += e.gross * fraction;
      const tax = germanCapitalTax(profile, report.shareGains, general).total;
      net = e.gross - Math.max(0, tax - previousTax);
      previousTax = tax;
    }
    return { ...e, net };
  });
  return { events, totalGross: raw.totalGross, bondsWithoutTerms: raw.bondsWithoutTerms,
    history: incomeByMonth(data.transactions, today), issues: report.issues };
}
