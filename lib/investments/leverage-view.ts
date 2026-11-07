import { computeBrokerLeverage, type BrokerLeverage, type LeverageSource } from "@/lib/calc/leverage";
import type { FxTable } from "@/lib/calc/fx";
import { computePortfolioSummary, type InstrumentInput, type InvestmentTransactionInput, type PriceIndex } from "@/lib/calc/investments";
import type { InvestmentData } from "./data";

/** What the Investimenti screens need about leverage: each account's figures and the input of the own-capital return. */
export interface LeverageView {
  /** Accounts with a loan or with debit interest paid, largest loan first. */
  accounts: BrokerLeverage[];
  /** Input of `computePortfolioReturns({ capital })`, null when no account carries its cash ledger. */
  capital: { transactions: InvestmentTransactionInput[]; sources: LeverageSource[] } | null;
}

/** True when an operation belongs to this broker account: tagged with its key, or in its own `ibkr:<key>` portfolio. */
function belongsTo(data: InvestmentData, source: LeverageSource) {
  const portfolios = new Set(data.portfolios.filter((p) => p.broker === `ibkr:${source.accountKey}`).map((p) => p.id));
  return (t: InvestmentData["transactions"][number]) => t.statementAccountKey === source.accountKey || (!t.statementAccountKey && portfolios.has(t.portfolioId));
}

/** Leverage of every broker account whose statements carry the cash ledger, valued at today's prices. */
export function buildLeverageView(
  data: InvestmentData,
  common: { transactions: InvestmentTransactionInput[]; instruments: InstrumentInput[]; priceIndex: PriceIndex; fx: FxTable; userCurrency: string },
  todayKey: string,
): LeverageView {
  const sources = data.leverage ?? [];
  if (!sources.length) return { accounts: [], capital: null };
  const inputById = new Map(common.transactions.map((t) => [t.id, t]));
  const accounts: BrokerLeverage[] = [];
  const capitalTransactions: InvestmentTransactionInput[] = [];
  for (const source of sources) {
    const own = data.transactions.filter(belongsTo(data, source)).flatMap((t) => inputById.get(t.id) ?? []);
    capitalTransactions.push(...own);
    const securities = own.length ? computePortfolioSummary({ ...common, transactions: own, todayKey }).totalValue : 0;
    const leverage = computeBrokerLeverage(source, securities, common.fx, common.userCurrency, todayKey);
    if (leverage && (leverage.loan > 0.005 || leverage.interest.byYear.length > 0)) accounts.push(leverage);
  }
  return { accounts: accounts.sort((a, b) => b.loan - a.loan), capital: { transactions: capitalTransactions, sources } };
}
