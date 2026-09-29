import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { inflationIndex } from "@/lib/db/schema/investments";
import { createLogger } from "@/lib/observability";
import { parseEurostatHicp, type InflationProvider } from "./providers/eurostat";
import { INFLATION_HISTORY_START, loadInflationIndex, updateInflationIndex } from "./inflation";

// Area inventata per non toccare i dati veri del DB di sviluppo.
const AREA = `T${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const ctx = { fetch: vi.fn() as unknown as typeof fetch, env: {} };
const silent = createLogger({ write: () => {} });

function provider(values: { month: string; value: number }[] | Error): InflationProvider & { calls: string[] } {
  const calls: string[] = [];
  return {
    id: "eurostat",
    calls,
    async fetchMonthlyIndex(_area, fromMonth) {
      calls.push(fromMonth);
      if (values instanceof Error) throw values;
      return values;
    },
  };
}

describe("parseEurostatHicp", () => {
  it("legge i mesi dalla dimensione tempo, in entrambi i formati, scartando i valori mancanti", () => {
    const body = {
      value: { "0": 119.5, "1": 120.1, "3": 121 },
      dimension: { time: { category: { index: { "2026-05": 0, "2026M06": 1, "2026-07": 2, "2026-08": 3 } } } },
    };
    expect(parseEurostatHicp(body)).toEqual([
      { month: "2026-05", value: 119.5 },
      { month: "2026-06", value: 120.1 },
      { month: "2026-08", value: 121 },
    ]);
  });

  it("una risposta senza dimensione tempo è un errore della fonte", () => {
    expect(() => parseEurostatHicp({})).toThrow();
  });
});

describe("updateInflationIndex", () => {
  beforeEach(async () => {
    await db.delete(inflationIndex).where(eq(inflationIndex.area, AREA));
  });
  afterAll(async () => {
    await db.delete(inflationIndex).where(eq(inflationIndex.area, AREA));
  });

  it("la prima volta scarica dal 2000, poi solo gli ultimi mesi, aggiornando le revisioni", async () => {
    const first = provider([
      { month: "2026-06", value: 120 },
      { month: "2026-07", value: 121 },
    ]);
    expect(await updateInflationIndex(new Date("2026-09-29"), ctx, { provider: first, area: AREA, log: silent })).toBe(2);
    expect(first.calls).toEqual([INFLATION_HISTORY_START]);

    const second = provider([{ month: "2026-07", value: 121.3 }]);
    await updateInflationIndex(new Date("2026-09-29"), ctx, { provider: second, area: AREA, log: silent });
    expect(second.calls).toEqual(["2023-09"]);
    expect(await loadInflationIndex(AREA)).toEqual([
      { month: "2026-06", value: 120 },
      { month: "2026-07", value: 121.3 },
    ]);
  });

  it("un errore della fonte non si propaga", async () => {
    expect(await updateInflationIndex(new Date(), ctx, { provider: provider(new Error("403")), area: AREA, log: silent })).toBe(0);
  });
});
