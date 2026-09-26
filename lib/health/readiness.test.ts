import { describe, expect, it } from "vitest";
import { checkReadiness } from "./readiness";

describe("checkReadiness", () => {
  it("è pronto quando tutte le probe rispondono", async () => {
    const result = await checkReadiness({ database: async () => 1, redis: async () => "PONG" });
    expect(result).toEqual({ ready: true, checks: { database: "ok", redis: "ok" } });
  });

  it("non è pronto se una probe fallisce, e segnala quale", async () => {
    const result = await checkReadiness({
      database: async () => 1,
      redis: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    expect(result).toEqual({ ready: false, checks: { database: "ok", redis: "error" } });
  });

  it("considera fallita una probe che non risponde entro il timeout", async () => {
    const hanging = () => new Promise(() => {});
    const startedAt = Date.now();
    const result = await checkReadiness({ redis: hanging }, 20);
    expect(result.checks.redis).toBe("error");
    expect(Date.now() - startedAt).toBeLessThan(1000);
  });

  it("gestisce una probe che lancia in modo sincrono", async () => {
    const result = await checkReadiness({
      database: () => {
        throw new Error("boom");
      },
    });
    expect(result.ready).toBe(false);
  });
});
