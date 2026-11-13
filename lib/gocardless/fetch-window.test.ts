import { describe, expect, it } from "vitest";
import { fullFetchKey, incrementalDateFrom, planFetchWindow, recordFullFetch } from "./fetch-window";
import type { RateLimitStore } from "./rate-limit";

function memoryStore(): RateLimitStore & { ttl: Map<string, number> } {
  const map = new Map<string, string>();
  const ttl = new Map<string, number>();
  return {
    ttl,
    get: async (key) => map.get(key) ?? null,
    set: async (key, value, seconds) => {
      map.set(key, value);
      ttl.set(key, seconds);
    },
  };
}

const broken: RateLimitStore = {
  get: async () => {
    throw new Error("redis down");
  },
  set: async () => {
    throw new Error("redis down");
  },
};

describe("fetch window", () => {
  const lastSync = new Date("2026-11-13T01:30:00Z");

  it("reads from 30 days before the last sync, as a UTC day", () => {
    expect(incrementalDateFrom(lastSync)).toBe("2026-10-14");
  });

  it("downloads everything on the first sync", async () => {
    expect(await planFetchWindow(memoryStore(), "ext", null)).toEqual({ mode: "full" });
  });

  it("downloads everything when the last full download is not known", async () => {
    expect(await planFetchWindow(memoryStore(), "ext", lastSync)).toEqual({ mode: "full" });
  });

  it("downloads everything when Redis does not answer", async () => {
    expect(await planFetchWindow(broken, "ext", lastSync)).toEqual({ mode: "full" });
    await expect(recordFullFetch(broken, "ext", lastSync)).resolves.toBeUndefined();
  });

  it("goes incremental after a full download, which expires after a week", async () => {
    const store = memoryStore();
    await recordFullFetch(store, "ext", lastSync);
    expect(store.ttl.get(fullFetchKey("ext"))).toBe(7 * 86_400);
    expect(await planFetchWindow(store, "ext", lastSync)).toEqual({ mode: "incremental", dateFrom: "2026-10-14" });
  });
});
