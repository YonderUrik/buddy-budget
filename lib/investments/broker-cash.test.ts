import { expect, it } from "vitest";
import { resolveBrokerCash } from "./broker-cash";

it("counts linked accounts once across sources, legacy portfolios and overlapping statements", () => {
  expect(resolveBrokerCash(
    [{ provider: "interactive-brokers", cashAccountId: "a" }, { provider: "interactive-brokers", cashAccountId: "a" }],
    [{ broker: "ibkr:legacy", statementCashAccountId: "a" }],
    [{ id: "a", name: "IBKR", balance: "-1399.10" }, { id: "bank", name: "Bank", balance: "5000" }],
    [{ cashAccountId: "a", to: "2026-09-30" }, { cashAccountId: "a", to: "2025-12-31" }],
  )).toEqual([{ accountId: "a", provider: "interactive-brokers", name: "IBKR", balance: -1399.1, statementDate: "2026-09-30" }]);
});
it("preserves zero balances and excludes missing/unowned accounts", () => {
  expect(resolveBrokerCash([{ provider: "degiro", cashAccountId: "other" }],
    [{ broker: "ibkr:legacy", statementCashAccountId: "a" }],
    [{ id: "a", name: "Cash", balance: "0" }], [])).toEqual([
    { accountId: "a", provider: "interactive-brokers", name: "Cash", balance: 0, statementDate: null },
  ]);
});
