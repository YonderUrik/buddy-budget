import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUnsubscribeToken, unsubscribeApiUrl, unsubscribePageUrl, verifyUnsubscribeToken } from "./token";

describe("token di disiscrizione", () => {
  beforeEach(() => vi.stubEnv("BETTER_AUTH_SECRET", "a".repeat(40)));
  afterEach(() => vi.unstubAllEnvs());

  it("riporta utente e ambito dopo la verifica", () => {
    const token = createUnsubscribeToken({ userId: "user_abc.123", scope: "budget" });
    expect(verifyUnsubscribeToken(token)).toEqual({ userId: "user_abc.123", scope: "budget" });
  });

  it("rifiuta un ambito cambiato a mano: la firma lo copre", () => {
    const [user, , signature] = createUnsubscribeToken({ userId: "u1", scope: "digest" }).split(".");
    expect(verifyUnsubscribeToken(`${user}.all.${signature}`)).toBeNull();
  });

  it("rifiuta un altro utente con la firma di un primo", () => {
    const [, scope, signature] = createUnsubscribeToken({ userId: "u1", scope: "digest" }).split(".");
    expect(verifyUnsubscribeToken(`${Buffer.from("u2").toString("base64url")}.${scope}.${signature}`)).toBeNull();
  });

  it("rifiuta token vuoti, malformati o con ambito sconosciuto", () => {
    for (const bad of [null, undefined, "", "a.b", "a.b.c.d", `${Buffer.from("u1").toString("base64url")}.tutto.abc`]) {
      expect(verifyUnsubscribeToken(bad)).toBeNull();
    }
  });

  it("con un altro segreto il token non vale più", () => {
    const token = createUnsubscribeToken({ userId: "u1", scope: "all" });
    vi.stubEnv("BETTER_AUTH_SECRET", "b".repeat(40));
    expect(verifyUnsubscribeToken(token)).toBeNull();
  });

  it("non è valido se manca il segreto, invece di firmare con una chiave vuota", () => {
    const token = createUnsubscribeToken({ userId: "u1", scope: "all" });
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    expect(verifyUnsubscribeToken(token)).toBeNull();
    expect(() => createUnsubscribeToken({ userId: "u1", scope: "all" })).toThrow();
  });

  it("costruisce gli indirizzi con il token codificato", () => {
    expect(unsubscribePageUrl("https://app.test", "a.b.c")).toBe("https://app.test/disiscrizione?t=a.b.c");
    expect(unsubscribeApiUrl("https://app.test", "a.b.c")).toBe("https://app.test/api/email/unsubscribe?t=a.b.c");
  });
});
