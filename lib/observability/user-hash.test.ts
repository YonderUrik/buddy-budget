import { afterEach, describe, expect, it, vi } from "vitest";
import { USER_HASH_LENGTH, hashUserId } from "./user-hash";

describe("hashUserId", () => {
  it("è deterministico, esadecimale e lungo 16", () => {
    const h = hashUserId("user-1");
    expect(h).toBe(hashUserId("user-1"));
    expect(h).toMatch(new RegExp(`^[0-9a-f]{${USER_HASH_LENGTH}}$`));
  });

  it("non contiene l'id e cambia con l'id", () => {
    expect(hashUserId("user-1")).not.toContain("user");
    expect(hashUserId("user-1")).not.toBe(hashUserId("user-2"));
  });

  describe("con LOG_HASH_SECRET", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("cambia rispetto al hash senza segreto e con un segreto diverso", () => {
      const plain = hashUserId("user-1");
      vi.stubEnv("LOG_HASH_SECRET", "a");
      const a = hashUserId("user-1");
      vi.stubEnv("LOG_HASH_SECRET", "b");
      const b = hashUserId("user-1");
      expect(a).not.toBe(plain);
      expect(a).not.toBe(b);
      expect(a).toMatch(new RegExp(`^[0-9a-f]{${USER_HASH_LENGTH}}$`));
    });
  });
});
