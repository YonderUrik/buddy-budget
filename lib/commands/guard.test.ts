import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ counts: new Map<string, number>(), down: false }));
vi.mock("@/lib/redis/client", () => ({
  redis: {
    incr: vi.fn(async (key: string) => {
      if (store.down) throw new Error("connection refused");
      const next = (store.counts.get(key) ?? 0) + 1;
      store.counts.set(key, next);
      return next;
    }),
    expire: vi.fn(async () => 1),
  },
}));

import { checkSentence, COMMAND_AI_LIMITS, consumeCommandQuota } from "./guard";

const NOW = new Date(Date.UTC(2026, 9, 25, 10, 30));
const ask = (userId: string, times: number, now = NOW) => Promise.all(Array.from({ length: times }, () => consumeCommandQuota(userId, now)));

describe("checkSentence", () => {
  it("refuses empty, overlong and letterless sentences before any counter", () => {
    expect(checkSentence(" a ")).toBe("empty");
    expect(checkSentence("x".repeat(500))).toBe("too_long");
    expect(checkSentence("12 34 56")).toBe("no_letters");
    expect(checkSentence("pagato 12 al bar")).toBeNull();
  });
});

describe("consumeCommandQuota", () => {
  beforeEach(() => {
    store.counts.clear();
    store.down = false;
  });

  it("lets a user ask up to the hourly limit, then refuses them only", async () => {
    expect(new Set(await ask("anna", COMMAND_AI_LIMITS.perHour))).toEqual(new Set(["ok"]));
    expect(await consumeCommandQuota("anna", NOW)).toBe("user_limit");
    expect(await consumeCommandQuota("bruno", NOW)).toBe("ok");
  });

  it("keeps the daily limit across hours", async () => {
    const hours = Math.ceil(COMMAND_AI_LIMITS.perDay / COMMAND_AI_LIMITS.perHour);
    for (let h = 0; h < hours; h++) await ask("anna", COMMAND_AI_LIMITS.perHour, new Date(Date.UTC(2026, 9, 25, h)));
    expect(await consumeCommandQuota("anna", new Date(Date.UTC(2026, 9, 25, 23)))).toBe("user_limit");
    expect(await consumeCommandQuota("anna", new Date(Date.UTC(2026, 9, 26, 0)))).toBe("ok");
  });

  it("stops everyone at the service ceiling", async () => {
    store.counts.set(`commands:ai:service:2026-10-25`, COMMAND_AI_LIMITS.servicePerDay);
    expect(await consumeCommandQuota("carla", NOW)).toBe("service_limit");
  });

  it("fails closed when Redis does not answer", async () => {
    store.down = true;
    expect(await consumeCommandQuota("anna", NOW)).toBe("store_down");
  });
});
