import type { InvestmentData } from "@/lib/investments/data";
import type { TaxProfile } from "./schema";
import { fundTaxableShare, germanCapitalTax } from "./countries/de";

export interface TaxIssue { instrumentId: string; reason: "currency" | "history" | "classification" | "fund-history" | "legacy" | "unsupported" | "missing-lots" | "invalid" }
export interface RealizedEvent { id: string; instrumentId: string; date: string; gain: number; taxable: number; basket: "shares" | "general" }
interface Lot { quantity: number; unitCost: number; date: string }
/** FIFO per custody account. Missing basis/classification blocks the aggregate estimate, never becomes zero cost. */
export function germanPortfolioReport(data: InvestmentData, profile: TaxProfile, todayKey: string) {
  const instruments = new Map(data.instruments.map(i => [i.id, i]));
  const lots = new Map<string, Lot[]>();
  const issues: TaxIssue[] = [];
  const events: RealizedEvent[] = [];
  const invalidKeys = new Set<string>();
  const issue = (instrumentId: string, reason: TaxIssue["reason"]) => {
    if (!issues.some(i => i.instrumentId === instrumentId && i.reason === reason)) issues.push({ instrumentId, reason });
  };
  if (data.currency !== "EUR") issue("", "currency");
  if (!profile.historyConfirmed) issue("", "history");
  const order = { split: 0, acquisto: 1, dividendo: 2, cedola: 2, vendita: 3, rimborso: 3, rettifica: 4 };
  const transactions = [...data.transactions].filter(t => t.date <= todayKey && Number(t.date.slice(0, 4)) <= profile.year)
    .sort((a, b) => a.date.localeCompare(b.date) || order[a.type] - order[b.type] || String(a.createdAt).localeCompare(String(b.createdAt)) || a.id.localeCompare(b.id));
  let recordedTaxes = 0;
  for (const t of transactions) {
    const inYear = Number(t.date.slice(0, 4)) === profile.year;
    if (inYear) recordedTaxes += Number(t.taxes);
    const instrument = instruments.get(t.instrumentId);
    const key = `${t.portfolioId}:${t.statementAccountKey ?? "manual"}:${t.instrumentId}`;
    const stack = lots.get(key) ?? [];
    lots.set(key, stack);
    // Private spot crypto is a separate §23 scenario, not a capital-income loss basket.
    if (instrument?.type === "crypto") continue;
    const fund = instrument?.type === "etf" || instrument?.type === "fondo";
    if (!instrument || !["azione", "obbligazione", "etf", "fondo"].includes(instrument.type)) {
      if (inYear) issue(t.instrumentId, "unsupported");
      continue;
    }
    const share = fund ? fundTaxableShare(profile.fundKinds[instrument.id] ?? "unknown") : 1;
    const q = Number(t.quantity), fx = Number(t.fxRate), fees = Number(t.fees), price = Number(t.price);
    if (![q, fx, fees, price].every(Number.isFinite) || fx <= 0 || fees < 0 || price < 0 || q < 0) {
      invalidKeys.add(key); issue(t.instrumentId, "invalid"); continue;
    }
    if (t.type === "rettifica") { invalidKeys.add(key); issue(t.instrumentId, "unsupported"); continue; }
    if (t.type === "split") {
      if (q <= 0) { invalidKeys.add(key); issue(t.instrumentId, "invalid"); }
      else stack.forEach(lot => { lot.quantity *= q; lot.unitCost /= q; });
      continue;
    }
    if (t.type === "acquisto") {
      if (q <= 0) { invalidKeys.add(key); issue(t.instrumentId, "invalid"); continue; }
      stack.push({ quantity: q, unitCost: price * fx / (instrument.priceUnit === "percentuale_nominale" ? 100 : 1) + fees / q, date: t.date });
      continue;
    }
    if (inYear && fund && share === null) issue(t.instrumentId, "classification");
    if (inYear && fund && !profile.fundHistoryConfirmed) issue(t.instrumentId, "fund-history");
    if (t.type === "dividendo" || t.type === "cedola") {
      const gross = Number(t.grossAmount);
      if (inYear && t.grossAmount !== null && Number.isFinite(gross) && share !== null) {
        // Custody and collection costs are not deductible as ordinary investment expenses (§20(9)).
        events.push({ id: t.id, instrumentId: t.instrumentId, date: t.date, gain: gross * fx, taxable: gross * fx * share, basket: "general" });
      } else if (inYear && (t.grossAmount === null || !Number.isFinite(gross))) issue(t.instrumentId, "invalid");
      continue;
    }
    if (q <= 0) { issue(t.instrumentId, "invalid"); invalidKeys.add(key); continue; }
    let remaining = q, basis = 0, legacy = false;
    while (remaining > 1e-9 && stack.length) {
      const lot = stack[0];
      const used = Math.min(lot.quantity, remaining);
      basis += used * lot.unitCost;
      legacy ||= lot.date < (fund ? "2018-01-01" : "2009-01-01");
      lot.quantity -= used; remaining -= used;
      if (lot.quantity < 1e-9) stack.shift();
    }
    if (remaining > 1e-9) { issue(t.instrumentId, "missing-lots"); invalidKeys.add(key); }
    if (inYear && legacy) issue(t.instrumentId, "legacy");
    if (!inYear || invalidKeys.has(key) || legacy || share === null) continue;
    const gain = q * price * fx / (instrument.priceUnit === "percentuale_nominale" ? 100 : 1) - fees - basis;
    const adjusted = gain - (fund ? profile.priorAdvancesBySale[t.id] ?? 0 : 0);
    events.push({ id: t.id, instrumentId: t.instrumentId, date: t.date, gain, taxable: adjusted * share,
      basket: instrument.type === "azione" ? "shares" : "general" });
  }
  const shareGains = events.filter(e => e.basket === "shares").reduce((s, e) => s + e.taxable, 0);
  const generalIncome = events.filter(e => e.basket === "general").reduce((s, e) => s + e.taxable, 0);
  return { events, issues, recordedTaxes, shareGains, generalIncome,
    estimate: issues.length ? null : germanCapitalTax(profile, shareGains, generalIncome) };
}
