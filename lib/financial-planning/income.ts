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
  let shareGains = report.shareGains;
  let activeProfile = profile, activeYear = profile.year as number;
  let lastEstimate = report.estimate;
  let previousTax = report.estimate?.total ?? 0;
  let canEstimate = report.estimate !== null;
  const instruments = new Map(data.instruments.map(i => [i.id, i]));
  const events = raw.events.filter(e => e.kind !== "rimborso").map(e => {
    const instrument = instruments.get(e.instrumentId);
    const fund = instrument?.type === "etf" || instrument?.type === "fondo";
    const fraction = fund ? fundTaxableShare(profile.fundKinds[e.instrumentId] ?? "unknown") : 1;
    const eligible = instrument && ["azione", "obbligazione", "etf", "fondo"].includes(instrument.type);
    const year = Number(e.date.slice(0, 4));
    if (year > activeYear && profile.futureForecast === "constant-2026" && lastEstimate) {
      activeProfile = { ...profile, allowanceUsedElsewhere: 0, otherCapitalIncome: 0, verifiedForeignCredit: 0, shareLosses: lastEstimate.remainingShareLosses, generalLosses: lastEstimate.remainingGeneralLosses };
      general = 0; shareGains = 0; previousTax = 0; activeYear = year;
    }
    if (fraction === null || !eligible || (year !== profile.year && profile.futureForecast !== "constant-2026")) canEstimate = false;
    let net: number | null = null;
    if (canEstimate && fraction !== null) {
      general += e.gross * fraction;
      lastEstimate = germanCapitalTax(activeProfile, shareGains, general);
      const tax = lastEstimate.total;
      net = e.gross - Math.max(0, tax - previousTax);
      previousTax = tax;
    }
    return { ...e, net, benchmark: year !== profile.year && profile.futureForecast === "constant-2026" };
  });
  return { events, totalGross: raw.totalGross, bondsWithoutTerms: raw.bondsWithoutTerms,
    history: incomeByMonth(data.transactions, today), issues: report.issues };
}
