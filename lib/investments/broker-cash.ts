export interface BrokerCash {
  accountId: string;
  provider: string;
  name: string;
  balance: number;
  statementDate: string | null;
}

/** Resolve owned broker accounts once, including legacy links; balances are already in the user's currency. */
export function resolveBrokerCash(
  sources: { provider: string; cashAccountId: string | null }[],
  portfolios: { broker: string | null; statementCashAccountId: string | null }[],
  accounts: { id: string; name: string; balance: string }[],
  statements: { cashAccountId: string | null; to: string }[],
): BrokerCash[] {
  const links = new Map<string, string>();
  for (const source of sources) if (source.cashAccountId) links.set(source.cashAccountId, source.provider);
  for (const portfolio of portfolios) {
    if (portfolio.statementCashAccountId && !links.has(portfolio.statementCashAccountId)) {
      links.set(portfolio.statementCashAccountId, portfolio.broker?.startsWith("degiro:") ? "degiro" : "interactive-brokers");
    }
  }
  return accounts.filter((account) => links.has(account.id)).map((account) => ({
    accountId: account.id, provider: links.get(account.id)!, name: account.name, balance: Number(account.balance),
    statementDate: statements.filter((s) => s.cashAccountId === account.id).map((s) => s.to).sort().at(-1) ?? null,
  }));
}
