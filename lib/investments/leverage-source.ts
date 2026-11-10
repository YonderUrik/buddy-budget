import type { LeverageMove, LeverageSource, LeverageStatement } from "@/lib/calc/leverage";
import type { BrokerStatement } from "./import/broker-statement";
import type { BrokerCash } from "./broker-cash";

/** Providers whose statements carry the whole cash ledger by currency, so the cash can be rebuilt day by day. */
export const LEVERAGE_PROVIDERS = new Set(["interactive-brokers"]);

/**
 * A stored statement reduced to balances and the day's movements by currency and kind. Fees already inside the trades'
 * commissions are left out, as when the statement was reconciled, so the movements add up to the closing balance.
 */
export function toLeverageStatement(statement: Pick<BrokerStatement, "from" | "to" | "cash" | "ledger">): LeverageStatement {
  const moves = new Map<string, LeverageMove>();
  for (const entry of statement.ledger) {
    if (entry.includedInCommission || !entry.amount) continue;
    // Only debit interest is a cost of the loan; credit and securities-lending interest stay ordinary cash.
    const kind: LeverageMove["kind"] = entry.kind === "Deposits & Withdrawals" ? "deposit" : entry.kind === "Interest" && entry.amount < 0 ? "interest" : "other";
    const key = `${entry.date}|${entry.currency}|${kind}`;
    const move = moves.get(key) ?? { date: entry.date, currency: entry.currency, amount: 0, kind };
    move.amount += entry.amount;
    moves.set(key, move);
  }
  return {
    from: statement.from,
    to: statement.to,
    opening: statement.cash.map((c) => ({ currency: c.currency, amount: c.opening })),
    closing: statement.cash.map((c) => ({ currency: c.currency, amount: c.closing })),
    moves: [...moves.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/** A stored statement as the loader reads it: only the parts leverage needs. */
export interface LeverageStatementRow {
  cashAccountId: string | null;
  accountKey: string;
  statement: Pick<BrokerStatement, "provider" | "from" | "to" | "cash" | "ledger">;
}

/** Leverage sources of the user's broker cash accounts: one per account, its statements in date order. */
export function buildLeverageSources(brokerCash: BrokerCash[], statements: LeverageStatementRow[]): LeverageSource[] {
  const sources: LeverageSource[] = [];
  for (const cash of brokerCash) {
    if (!LEVERAGE_PROVIDERS.has(cash.provider)) continue;
    const own = statements
      .filter((s) => s.cashAccountId === cash.accountId && (s.statement.provider ?? "interactive-brokers") === cash.provider && Array.isArray(s.statement.ledger) && Array.isArray(s.statement.cash))
      .sort((a, b) => a.statement.from.localeCompare(b.statement.from));
    if (!own.length) continue;
    sources.push({ accountId: cash.accountId, accountKey: own[0].accountKey, provider: cash.provider, name: cash.name, statements: own.map((s) => toLeverageStatement(s.statement)) });
  }
  return sources;
}

/** Currencies the leverage sources hold, whose rates the client needs to value them. */
export function leverageCurrencies(sources: LeverageSource[]): string[] {
  const currencies = new Set<string>();
  for (const source of sources) for (const s of source.statements) {
    for (const c of s.closing) currencies.add(c.currency);
    for (const c of s.opening) currencies.add(c.currency);
    for (const m of s.moves) currencies.add(m.currency);
  }
  return [...currencies];
}
