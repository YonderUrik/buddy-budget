import { describe, expect, it, vi } from "vitest";
import { patientSearches } from "./patient-search";

const hit = { symbol: "META", name: "META", exchange: "NMS", exchangeLabel: "NASDAQ", type: "azione" as const };

describe("searches of a background import", () => {
  it("asks a throttled source again instead of settling for no quotation", async () => {
    const searchByIsin = vi.fn().mockResolvedValueOnce({ status: "unavailable", hits: [] }).mockResolvedValueOnce({ status: "unavailable", hits: [] }).mockResolvedValue({ status: "ok", hits: [hit] });
    const sleep = vi.fn(async (ms: number) => { void ms; });
    const deps = patientSearches({ searchMarket: async () => [], searchCrypto: async () => [], searchByIsin }, { sleep, waitMs: 10 });
    expect(await deps.searchByIsin!("US30303M1027", "USD", "US")).toMatchObject({ status: "ok", hits: [hit] });
    expect(searchByIsin).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([10, 20]);
  });
  it("gives up after the last attempt and passes errors on", async () => {
    const down = vi.fn().mockResolvedValue({ status: "unavailable", hits: [] });
    const failing = vi.fn().mockRejectedValue(new Error("429"));
    const deps = patientSearches({ searchMarket: failing, searchCrypto: async () => [], searchByIsin: down }, { sleep: async () => {}, attempts: 3 });
    expect(await deps.searchByIsin!("X", null)).toEqual({ status: "unavailable", hits: [] });
    expect(down).toHaveBeenCalledTimes(3);
    await expect(deps.searchMarket("x")).rejects.toThrow("429");
    expect(failing).toHaveBeenCalledTimes(3);
  });
  it("an empty answer is final: the security is not on any exchange", async () => {
    const empty = vi.fn().mockResolvedValue({ status: "empty", hits: [] });
    const deps = patientSearches({ searchMarket: async () => [], searchCrypto: async () => [], searchByIsin: empty }, { sleep: async () => {} });
    await deps.searchByIsin!("X", null);
    expect(empty).toHaveBeenCalledTimes(1);
  });
});
