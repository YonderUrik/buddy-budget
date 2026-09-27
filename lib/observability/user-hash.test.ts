import { describe, expect, it } from "vitest";
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
});
