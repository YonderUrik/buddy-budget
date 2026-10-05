import type { InvestmentData } from "./data";
import type { InvestmentTransaction } from "@/lib/db/schema/investments";

export interface BrokerGroup { id: string; label: string; operations: number }
const LABELS: Record<string, string> = { "interactive-brokers": "Interactive Brokers", degiro: "DEGIRO", manual: "Manuali e import precedenti" };

/** Identify provenance even when two brokers share a portfolio, with explicit fallback for legacy rows. */
export function transactionBroker(data: InvestmentData, operation: InvestmentTransaction): string {
  if (operation.statementAccountKey) return data.brokerSources?.find((s) => s.accountKey === operation.statementAccountKey)?.provider ?? `source:${operation.statementAccountKey}`;
  const portfolio = data.portfolios.find((p) => p.id === operation.portfolioId);
  if (portfolio?.broker?.startsWith("ibkr:")) return "interactive-brokers";
  if (portfolio?.broker?.startsWith("degiro:")) return "degiro";
  return "manual";
}

/** Available broker toggles; manual/unidentified history remains separately selectable. */
export function investmentBrokerGroups(data: InvestmentData): BrokerGroup[] {
  const groups = new Map<string, BrokerGroup>();
  for (const operation of data.transactions) {
    const id = transactionBroker(data, operation);
    const group = groups.get(id) ?? { id, label: LABELS[id] ?? "Altro conto broker", operations: 0 };
    group.operations += 1; groups.set(id, group);
  }
  for (const cash of data.brokerCash ?? []) {
    if (!groups.has(cash.provider)) groups.set(cash.provider, { id: cash.provider, label: LABELS[cash.provider] ?? "Altro conto broker", operations: 0 });
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** View-only filter: never delete transactions or change stored net-worth/account balances. */
export function filterInvestmentBrokers(data: InvestmentData, disabled: ReadonlySet<string>): InvestmentData {
  if (!disabled.size) return data;
  const transactions = data.transactions.filter((t) => !disabled.has(transactionBroker(data, t)));
  const ids = new Set(transactions.map((t) => t.instrumentId));
  return { ...data, brokerCash: data.brokerCash?.filter((cash) => !disabled.has(cash.provider)), transactions, instruments: data.instruments.filter((i) => ids.has(i.id)), targets: data.targets.filter((t) => ids.has(t.instrumentId)) };
}
