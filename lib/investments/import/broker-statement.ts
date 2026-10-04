import type { ActivityRecord } from "./interactive-brokers";
import { parseNumber } from "./values";

export interface BrokerCashEntry {
  line: number; date: string; currency: string; amount: number; kind: string; description: string;
  /** Transaction fees can already be included in Trades/Comm/Fee. Never charge them twice. */
  includedInCommission?: boolean;
}
export interface BrokerPosition {
  symbol: string; currency: string; quantity: number; price: number; value: number; costBasis: number; unrealized: number;
}
export interface BrokerStatement {
  account: string; currency: string; from: string; to: string;
  nav: { label: string; prior: number; value: number }[];
  cash: { currency: string; opening: number; closing: number; calculated: number; difference: number }[];
  positions: BrokerPosition[];
  ledger: BrokerCashEntry[];
  /** Broker figures are retained separately from BuddyBudget's tax/average-cost calculations. */
  performance: { symbol: string; currency: string | null; values: Record<string, number> }[];
  issues: string[];
}
export const statementValue = (r: ActivityRecord, key: string) => r.values[r.headers.indexOf(key)]?.trim() ?? "";
/** Read a strict IBKR number; reject malformed values instead of silently trimming them. */
export const statementNumber = (r: ActivityRecord, key: string) => {
  const raw = statementValue(r, key);
  if (!/^[+-]?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw)) return null;
  return parseNumber(raw, ".");
};
const currencyCode = (s: string) => /^[A-Z]{3}$/.test(s);
const money = (r: ActivityRecord, key: string) => {
  const n = statementNumber(r, key);
  if (n === null) throw new Error(`${r.section}, riga ${r.line}: ${key} non valido`);
  return n;
};
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function statementDate(raw: string): string {
  const match = /^(\w+) (\d{1,2}), (\d{4})$/.exec(raw.trim());
  if (!match || !months.includes(match[1])) throw new Error("Periodo del rendiconto non valido");
  const date = `${match[3]}-${String(months.indexOf(match[1]) + 1).padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  if (new Date(date).toISOString().slice(0, 10) !== date) throw new Error("Periodo del rendiconto non valido");
  return date;
}

/** Extract statement-level cash accounting and broker valuations without using market-provider estimates. */
export function readBrokerStatement(records: ActivityRecord[]): BrokerStatement | null {
  const data = records.filter((r) => r.kind === "Data");
  const field = (section: string, key: string) => data.find((r) => r.section === section && statementValue(r, "Field Name") === key);
  const getField = (section: string, key: string) => { const r = field(section, key); return r ? statementValue(r, "Field Value") : ""; };
  // Compact CSV examples are still accepted by the parser; a complete import requires Cash Report and NAV.
  if (!data.some((r) => r.section === "Cash Report") || !data.some((r) => r.section === "Net Asset Value")) return null;
  const [fromRaw, toRaw] = getField("Statement", "Period").split(" - ");
  const from = statementDate(fromRaw ?? ""); const to = statementDate(toRaw ?? fromRaw ?? "");
  const currency = getField("Account Information", "Base Currency");
  const account = getField("Account Information", "Account");
  if (!account || !currencyCode(currency) || from > to) throw new Error("Conto, valuta o periodo del rendiconto non validi");
  const ledger: BrokerCashEntry[] = []; const issues: string[] = [];
  const report = data.filter((r) => r.section === "Cash Report");
  const add = (r: ActivityRecord, kind: string, c: string, amount: number, description: string) => {
    if (!currencyCode(c)) throw new Error(`${r.section}, riga ${r.line}: valuta non valida`);
    const date = (statementValue(r, "Date/Time") || statementValue(r, "Date") || statementValue(r, "Settle Date")).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date < from || date > to) throw new Error(`${r.section}, riga ${r.line}: data fuori periodo`);
    ledger.push({ line: r.line, kind, currency: c, amount, date, description });
  };
  for (const r of data) {
    const c = statementValue(r, "Currency");
    if (r.section === "Trades" && statementValue(r, "DataDiscriminator") === "Order") {
      const symbol = statementValue(r, "Symbol");
      add(r, "trade", c, money(r, "Proceeds"), symbol);
      if (statementValue(r, "Asset Category") === "Forex") {
        const [base, quote] = symbol.split(".");
        if (quote !== c) throw new Error(`Cambio valuta non riconosciuto alla riga ${r.line}`);
        add(r, "forex", base, money(r, "Quantity"), symbol);
        const commissionHeader = r.headers.find((h) => h.startsWith("Comm in "));
        if (!commissionHeader) throw new Error(`Valuta commissione Forex mancante alla riga ${r.line}`);
        add(r, "commission", commissionHeader.slice(8), money(r, commissionHeader), symbol);
      } else add(r, "commission", c, money(r, "Comm/Fee"), symbol);
    } else if (["Dividends", "Withholding Tax", "Deposits & Withdrawals", "Interest", "Fees", "Transaction Fees"].includes(r.section) && currencyCode(c)) {
      add(r, r.section, c, money(r, "Amount"), statementValue(r, "Description"));
    } else if (r.section === "Corporate Actions" && currencyCode(c)) {
      const proceeds = money(r, "Proceeds");
      if (proceeds !== 0) add(r, r.section, c, proceeds, statementValue(r, "Description"));
    }
  }
  for (const c of new Set(ledger.map((r) => r.currency))) {
    const fees = ledger.filter((r) => r.currency === c && r.kind === "Transaction Fees");
    const feeTotal = fees.reduce((s, r) => s + r.amount, 0);
    const commissionTotal = ledger.filter((r) => r.currency === c && r.kind === "commission").reduce((s, r) => s + r.amount, 0);
    const row = report.find((r) => statementValue(r, "Currency") === c && statementValue(r, "Currency Summary") === "Commissions");
    const reported = row ? money(row, "Total") : 0;
    if (fees.length && Math.abs(commissionTotal - reported - feeTotal) < 0.0001) {
      for (const fee of fees) fee.includedInCommission = true;
    } else if (Math.abs(commissionTotal - reported) > 0.0001) issues.push(`Commissioni ${c}: dettaglio e Cash Report non coincidono`);
  }
  const cash = report.filter((r) => statementValue(r, "Currency Summary") === "Ending Cash" && currencyCode(statementValue(r, "Currency"))).map((r) => {
    const c = statementValue(r, "Currency");
    const start = report.find((s) => statementValue(s, "Currency") === c && statementValue(s, "Currency Summary") === "Starting Cash");
    if (!start) throw new Error(`Saldo iniziale ${c} mancante`);
    const opening = money(start, "Total"); const closing = money(r, "Total");
    const calculated = opening + ledger.filter((l) => l.currency === c && !l.includedInCommission).reduce((s, l) => s + l.amount, 0);
    const difference = calculated - closing;
    if (Math.abs(difference) > 0.0001) issues.push(`Cassa ${c}: scarto ${difference.toFixed(6)} tra movimenti e saldo finale`);
    return { currency: c, opening, closing, calculated, difference };
  });
  if (!cash.length) issues.push("Saldi di cassa per valuta mancanti");
  for (const c of new Set(ledger.map((r) => r.currency))) if (!cash.some((r) => r.currency === c)) issues.push(`Saldo finale ${c} mancante`);
  const nav = data.filter((r) => r.section === "Net Asset Value" && r.headers.includes("Current Total")).map((r) => ({ label: statementValue(r, "Asset Class"), prior: money(r, "Prior Total"), value: money(r, "Current Total") }));
  const total = nav.find((r) => r.label === "Total");
  if (!total || Math.abs(nav.filter((r) => r.label !== "Total").reduce((sum, r) => sum + r.value, 0) - total.value) > 0.01) issues.push("Totale NAV non riconciliato");
  const positions = data.filter((r) => r.section === "Open Positions" && statementValue(r, "DataDiscriminator") === "Summary" && currencyCode(statementValue(r, "Currency"))).map((r) => ({
    symbol: statementValue(r, "Symbol"), currency: statementValue(r, "Currency"), quantity: money(r, "Quantity"), price: money(r, "Close Price"), value: money(r, "Value"), costBasis: money(r, "Cost Basis"), unrealized: money(r, "Unrealized P/L"),
  }));
  const performance = data.filter((r) => r.section === "Realized & Unrealized Performance Summary").map((r) => ({ symbol: statementValue(r, "Symbol"), currency: statementValue(r, "Currency") || null, values: Object.fromEntries(r.headers.filter((h) => !["Asset Category", "Symbol", "Currency", "Code"].includes(h)).flatMap((h) => { const n = statementNumber(r, h); return n === null ? [] : [[h, n]]; })) }));
  return { account, currency, from, to, nav, cash, positions, ledger, performance, issues };
}
