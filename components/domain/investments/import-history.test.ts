import { describe, expect, it } from "vitest";
import type { BrokerStatement } from "@/lib/investments/import/broker-statement";
import { buildImportHistory, formatImportDate, groupImports } from "./import-history";

const statement = (over: Partial<BrokerStatement> = {}): BrokerStatement =>
  ({ provider: "degiro", account: "", currency: "EUR", from: "2025-01-01", to: "2025-12-31", nav: [], cash: [], positions: [], ledger: [], performance: [], issues: [], ...over }) as BrokerStatement;

describe("buildImportHistory", () => {
  it("racconta periodo, dettagli e stato di un rendiconto", () => {
    const [item] = buildImportHistory([{ id: "a", createdAt: "2026-01-02T10:00:00Z", statement: statement({ issues: ["x"], ledger: [{} as never, {} as never] }) }], undefined);
    expect(item.source).toBe("DEGIRO");
    expect(item.period).toContain("2025");
    expect(item.details).toEqual(["2 movimenti di cassa"]);
    expect(item.status).toEqual({ label: "1 avviso", tone: "warning" });
  });

  it("unisce i CSV personali con il nome del formato e ordina dal più recente", () => {
    const items = buildImportHistory(
      [{ id: "a", createdAt: "2026-01-01T00:00:00Z", statement: statement() }],
      { formats: [{ id: "f", name: "Banca X" }], jobs: [{ id: "j", formatId: "f", status: "imported", estimatedAt: "", expiresAt: "", createdAt: "2026-02-01T00:00:00Z", error: null, notifiedAt: null }] },
    );
    expect(items.map((i) => i.source)).toEqual(["Banca X", "DEGIRO"]);
    expect(items[0].status.tone).toBe("ok");
  });

  it("raggruppa per origine", () => {
    const items = buildImportHistory([
      { id: "a", createdAt: "2026-01-01T00:00:00Z", statement: statement() },
      { id: "b", createdAt: "2026-03-01T00:00:00Z", statement: statement() },
    ], undefined);
    expect(groupImports(items)).toHaveLength(1);
    expect(groupImports(items)[0].items.map((i) => i.id)).toEqual(["b", "a"]);
  });
});

describe("formatImportDate", () => {
  it("lascia com'è ciò che non è una data", () => {
    expect(formatImportDate("boh")).toBe("boh");
  });
});
