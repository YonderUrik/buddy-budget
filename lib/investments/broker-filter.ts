import type { InvestmentData } from "./data";
import type { InvestmentTransaction } from "@/lib/db/schema/investments";

export interface BrokerGroup { id: string; label: string; operations: number }
const LABELS: Record<string, string> = { "interactive-brokers": "Interactive Brokers", degiro: "DEGIRO", "trade-republic": "Trade Republic", "trade-republic-api": "Trade Republic", fineco: "Fineco", "yahoo-portfolio": "Yahoo Finance", manual: "Manuali e import precedenti" };

/** Identify provenance even when two brokers share a portfolio, with explicit fallback for legacy rows. */
export function transactionBroker(data: InvestmentData, operation: InvestmentTransaction): string {
  if (operation.statementAccountKey) return data.brokerSources?.find((s) => s.accountKey === operation.statementAccountKey)?.provider ?? `source:${operation.statementAccountKey}`;
  const portfolio = data.portfolios.find((p) => p.id === operation.portfolioId);
  if (portfolio?.broker?.startsWith("ibkr:")) return "interactive-brokers";
  if (portfolio?.broker?.startsWith("degiro:")) return "degiro";
  if (portfolio?.broker?.startsWith("personal:")) return portfolio.broker;
  if (portfolio?.broker === "fineco" || portfolio?.broker === "yahoo-portfolio") return portfolio.broker;
  return "manual";
}

/** Available broker toggles; manual/unidentified history remains separately selectable. */
export function investmentBrokerGroups(data: InvestmentData): BrokerGroup[] {
  const groups = new Map<string, BrokerGroup>();
  for (const operation of data.transactions) {
    const id = transactionBroker(data, operation);
    const group = groups.get(id) ?? { id, label: (id.startsWith("personal:") ? data.personalSources?.find(s => `personal:${s.id}` === id)?.name : undefined) ?? LABELS[id] ?? "Altro conto broker", operations: 0 };
    group.operations += 1; groups.set(id, group);
  }
  for (const cash of data.brokerCash ?? []) {
    // Empty accounts are retained for reimport, but are not active broker history.
    if (cash.balance === 0 && cash.statementDate === null) continue;
    if (!groups.has(cash.provider)) groups.set(cash.provider, { id: cash.provider, label: LABELS[cash.provider] ?? "Altro conto broker", operations: 0 });
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Label of where each operation comes from, by operation id, for the operations list: the broker, as in the broker
 * filter (the portfolio's name when two accounts of the same broker would read alike), or the portfolio's name for
 * hand-entered operations. Empty when every operation has the same label. The default portfolio keeps its stored
 * Italian name («Portafoglio»): the UI translates it.
 */
export function operationSourceLabels(data: Pick<InvestmentData, "transactions" | "portfolios" | "brokerSources" | "personalSources">): Map<string, string> {
  const portfolioName = new Map(data.portfolios.map((p) => [p.id, p.name]));
  const sourceOf = (t: InvestmentTransaction) => transactionBroker(data as InvestmentData, t);
  const brokerLabel = (id: string) => (id.startsWith("personal:") ? data.personalSources?.find((s) => `personal:${s.id}` === id)?.name : undefined) ?? LABELS[id] ?? "Altro conto broker";
  // Sources that share a broker label (two Interactive Brokers accounts) are told apart by their portfolio.
  const keysByLabel = new Map<string, Set<string>>();
  for (const t of data.transactions) {
    const source = sourceOf(t);
    if (source === "manual") continue;
    const label = brokerLabel(source);
    keysByLabel.set(label, (keysByLabel.get(label) ?? new Set()).add(`${t.statementAccountKey ?? ""}|${t.portfolioId}`));
  }
  const labels = new Map<string, string>();
  for (const t of data.transactions) {
    const source = sourceOf(t);
    const name = portfolioName.get(t.portfolioId) ?? "";
    const label = source === "manual" ? name : brokerLabel(source);
    labels.set(t.id, source !== "manual" && (keysByLabel.get(label)?.size ?? 0) > 1 ? name || label : label);
  }
  return new Set(labels.values()).size > 1 ? labels : new Map();
}

/** View-only filter: never delete transactions or change stored net-worth/account balances. */
export function filterInvestmentBrokers(data: InvestmentData, disabled: ReadonlySet<string>): InvestmentData {
  if (!disabled.size) return data;
  const transactions = data.transactions.filter((t) => !disabled.has(transactionBroker(data, t)));
  const ids = new Set(transactions.map((t) => t.instrumentId));
  return { ...data, brokerCash: data.brokerCash?.filter((cash) => !disabled.has(cash.provider)), transactions, instruments: data.instruments.filter((i) => ids.has(i.id)), targets: data.targets.filter((t) => ids.has(t.instrumentId)) };
}
