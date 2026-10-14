import { describe, expect, it, vi } from "vitest";
import { eurostatProvider, parseEurostatHicp } from "./eurostat";

function payload(geo = "DE", unit = "I25") {
  const index = (key: string) => ({ category: { index: { [key]: 0 } } });
  return { id: ["freq", "unit", "coicop18", "geo", "time"], size: [1, 1, 1, 1, 2], dimension: {
    freq: index("M"), unit: index(unit), coicop18: index("TOTAL"), geo: index(geo),
    time: { category: { index: { "2025-12": 0, "2026-01": 1 } } },
  }, value: { "0": 100, "1": 102 } };
}
describe("current Eurostat HICP series", () => {
  it("requests a single monthly national all-items index on the 2025 base", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(payload()));
    expect(await eurostatProvider.fetchMonthlyIndex("DE", "2000-01", { fetch, env: {} })).toEqual([{ month: "2025-12", value: 100 }, { month: "2026-01", value: 102 }]);
    const url = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(url.pathname).toContain("prc_hicp_minr");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ geo: "DE", unit: "I25", freq: "M", coicop18: "TOTAL", sinceTimePeriod: "2000-01" });
  });
  it("rejects the wrong country, reference base, or multiple series", async () => {
    for (const body of [payload("IT"), payload("DE", "I15"), { ...payload(), size: [1, 2, 1, 1, 2] }]) {
      await expect(eurostatProvider.fetchMonthlyIndex("DE", "2000-01", { fetch: vi.fn(async () => Response.json(body)), env: {} })).rejects.toThrow();
    }
  });
  it("discards invalid and unavailable monthly observations", () => {
    expect(parseEurostatHicp({ dimension: { time: { category: { index: { "2026-13": 0, "2026-01": 1, "2026-02": 2 } } } }, value: { "0": 100, "1": null, "2": -1 } })).toEqual([]);
  });
});
