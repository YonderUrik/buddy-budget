import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ counts: new Map<string, number>(), values: new Map<string, string>(), down: false }));
vi.mock("@/lib/redis/client", () => ({
  redis: {
    get: vi.fn(async (key: string) => store.values.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.values.set(key, value);
      return "OK";
    }),
    incr: vi.fn(async (key: string) => {
      if (store.down) throw new Error("connection refused");
      const next = (store.counts.get(key) ?? 0) + 1;
      store.counts.set(key, next);
      return next;
    }),
    expire: vi.fn(async () => 1),
  },
}));

import { cacheInterpretation, cachedInterpretation, checkSentence, COMMAND_AI_LIMITS, consumeCommandQuota } from "./guard";
import type { CommandDraft } from "./types";

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

describe("cachedInterpretation", () => {
  const draft: CommandDraft = { kind: "spesa", amount: 12, quantity: null, price: null, currency: null, date: "2026-10-25", subject: "Bar", language: "it", source: "ai", guessed: false };

  it("gives back a draft, a question or «neither» for the same sentence the same day", async () => {
    await cacheInterpretation("anna", "pagato 12 al bar", "2026-10-25", { type: "draft", draft });
    await cacheInterpretation("anna", "quanto in pizza", "2026-10-25", { type: "question", question: { kind: "rata", language: "it" } });
    await cacheInterpretation("anna", "ciao come stai", "2026-10-25", null);
    expect(await cachedInterpretation("anna", "pagato 12 al bar", "2026-10-25")).toEqual({ type: "draft", draft });
    expect(await cachedInterpretation("anna", "quanto in pizza", "2026-10-25")).toEqual({ type: "question", question: { kind: "rata", language: "it" } });
    expect(await cachedInterpretation("anna", "ciao come stai", "2026-10-25")).toBeNull();
    expect(await cachedInterpretation("bruno", "pagato 12 al bar", "2026-10-25")).toBeUndefined();
  });

  it("still reads a bare draft cached before questions existed", async () => {
    await cacheInterpretation("carla", "pagato 12 al bar", "2026-10-25", null);
    const [key] = [...store.values.keys()].filter((k) => store.values.get(k) === "null").slice(-1);
    store.values.set(key, JSON.stringify(draft));
    expect(await cachedInterpretation("carla", "pagato 12 al bar", "2026-10-25")).toEqual({ type: "draft", draft });
  });
});
