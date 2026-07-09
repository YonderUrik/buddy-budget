import { describe, expect, it } from "vitest";
import { isRateLimited, recordRateLimit, type RateLimitStore } from "./rate-limit";

function createMemoryStore(): RateLimitStore {
  const map = new Map<string, string>();
  return {
    async get(key) {
      return map.get(key) ?? null;
    },
    async set(key, value) {
      map.set(key, value);
    },
  };
}

describe("rate-limit", () => {
  it("nessuna voce registrata → via libera", async () => {
    const store = createMemoryStore();
    expect(await isRateLimited(store, "acc-1", "balances")).toBe(false);
  });

  it("remaining > 0 → via libera", async () => {
    const store = createMemoryStore();
    await recordRateLimit(store, "acc-1", "balances", 3, 3600);
    expect(await isRateLimited(store, "acc-1", "balances")).toBe(false);
  });

  it("remaining = 0 → bloccato", async () => {
    const store = createMemoryStore();
    await recordRateLimit(store, "acc-1", "balances", 0, 3600);
    expect(await isRateLimited(store, "acc-1", "balances")).toBe(true);
  });

  it("endpoint diversi sullo stesso conto sono indipendenti", async () => {
    const store = createMemoryStore();
    await recordRateLimit(store, "acc-1", "balances", 0, 3600);
    expect(await isRateLimited(store, "acc-1", "transactions")).toBe(false);
  });
});
