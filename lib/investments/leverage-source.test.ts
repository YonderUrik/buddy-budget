import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildFxTable } from "@/lib/calc/fx";
import { buildCashSeries } from "@/lib/calc/leverage";
import { parseInteractiveBrokersActivity } from "./import/interactive-brokers";
import { buildLeverageSources, leverageCurrencies, toLeverageStatement } from "./leverage-source";

const FULL = readFileSync(join(__dirname, "import/__fixtures__/interactive-brokers-full.csv"), "utf8");

describe("toLeverageStatement", () => {
  const statement = parseInteractiveBrokersActivity(FULL, "2026-10-04").statement!;
  const compact = toLeverageStatement(statement);

  it("keeps movements that add up to each currency's closing cash", () => {
    for (const c of statement.cash) {
      const moved = compact.moves.filter((m) => m.currency === c.currency).reduce((sum, m) => sum + m.amount, 0);
      expect(c.opening + moved).toBeCloseTo(c.calculated, 6);
    }
  });

  it("marks only debit interest as interest, and deposits as deposits", () => {
    const debit = statement.ledger.filter((l) => l.kind === "Interest" && l.amount < 0).reduce((sum, l) => sum + l.amount, 0);
    expect(compact.moves.filter((m) => m.kind === "interest").reduce((sum, m) => sum + m.amount, 0)).toBeCloseTo(debit, 6);
    expect(compact.moves.filter((m) => m.kind === "interest").every((m) => m.amount < 0)).toBe(true);
    const deposits = statement.ledger.filter((l) => l.kind === "Deposits & Withdrawals").reduce((sum, l) => sum + l.amount, 0);
    expect(compact.moves.filter((m) => m.kind === "deposit").reduce((sum, m) => sum + m.amount, 0)).toBeCloseTo(deposits, 6);
  });

  it("ends the rebuilt cash on the statement's closing balances", () => {
    const source = { accountId: "a", accountKey: "U1", provider: "interactive-brokers", name: "IB", statements: [compact] };
    const eur = buildCashSeries([{ ...source, statements: [{ ...compact, closing: compact.closing.filter((c) => c.currency === "EUR"), opening: compact.opening.filter((c) => c.currency === "EUR"), moves: compact.moves.filter((m) => m.currency === "EUR") }] }], buildFxTable([]), "EUR", [statement.to]);
    expect(eur.cash[0]).toBeCloseTo(statement.cash.find((c) => c.currency === "EUR")!.closing, 6);
    expect(leverageCurrencies([source]).sort()).toEqual(statement.cash.map((c) => c.currency).sort());
  });
});

describe("buildLeverageSources", () => {
  const statement = { from: "2025-01-01", to: "2025-12-31", cash: [{ currency: "EUR", opening: 0, closing: -10, calculated: -10, difference: 0 }], ledger: [] };
  const cash = (accountId: string, provider: string) => ({ accountId, provider, name: accountId, balance: -10, statementDate: "2025-12-31" });

  it("takes only accounts of providers with a whole cash ledger, statements in date order", () => {
    const sources = buildLeverageSources([cash("ib", "interactive-brokers"), cash("dg", "degiro")], [
      { cashAccountId: "ib", accountKey: "U1", statement: { ...statement, from: "2026-01-01", to: "2026-06-30", provider: "interactive-brokers" } },
      { cashAccountId: "ib", accountKey: "U1", statement },
      { cashAccountId: "dg", accountKey: "degiro:1", statement: { ...statement, provider: "degiro" } },
    ]);
    expect(sources.map((s) => s.accountId)).toEqual(["ib"]);
    expect(sources[0].statements.map((s) => s.from)).toEqual(["2025-01-01", "2026-01-01"]);
  });
});
