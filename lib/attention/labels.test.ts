import { describe, expect, it } from "vitest";
import { describeAttention, formatBadgeCount } from "./labels";

describe("describeAttention", () => {
  it("omette la parte a zero", () => {
    expect(describeAttention(0, 0)).toBe("");
    expect(describeAttention(1, 0)).toBe("1 nuova");
    expect(describeAttention(0, 7)).toBe("7 da categorizzare");
  });
  it("unisce nuove e da categorizzare", () => {
    expect(describeAttention(4, 7)).toBe("4 nuove · 7 da categorizzare");
  });
});

describe("formatBadgeCount", () => {
  it("tronca oltre 99", () => {
    expect(formatBadgeCount(9)).toBe("9");
    expect(formatBadgeCount(99)).toBe("99");
    expect(formatBadgeCount(100)).toBe("99+");
  });
});
