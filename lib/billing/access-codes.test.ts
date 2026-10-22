import { describe, expect, it } from "vitest";
import { accessCodeRejection, generateAccessCode, hashAccessCode, normalizeAccessCode } from "./access-codes";

const NOW = new Date("2026-10-20T10:00:00Z");

describe("access codes", () => {
  it("matches however the code is typed", () => {
    expect(normalizeAccessCode(" bb-k7qm 2xrt ")).toBe("BBK7QM2XRT");
    expect(hashAccessCode("bb-k7qm-2xrt")).toBe(hashAccessCode("BBK7QM2XRT"));
    expect(hashAccessCode("BB-K7QM-2XRT")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates BB-XXXX-XXXX without look-alike characters", () => {
    const code = generateAccessCode();
    expect(code).toMatch(/^BB-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(code).not.toMatch(/[01OIL]/);
  });

  it("refuses missing, disabled, expired and used-up codes", () => {
    const base = { maxRedemptions: 2, redemptions: 0, expiresAt: null, disabledAt: null };
    expect(accessCodeRejection(null, NOW)).toBe("invalid");
    expect(accessCodeRejection({ ...base, disabledAt: NOW }, NOW)).toBe("invalid");
    expect(accessCodeRejection({ ...base, expiresAt: NOW }, NOW)).toBe("expired");
    expect(accessCodeRejection({ ...base, redemptions: 2 }, NOW)).toBe("used_up");
    expect(accessCodeRejection({ ...base, redemptions: 1, expiresAt: new Date("2026-12-01") }, NOW)).toBeNull();
  });
});
