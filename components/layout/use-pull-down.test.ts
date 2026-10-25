import { describe, expect, it } from "vitest";
import { PULL_THRESHOLD_PX, pullDistance } from "./use-pull-down";

describe("pullDistance", () => {
  it("follows the finger at half speed, never upwards and never past its stop", () => {
    expect(pullDistance(-30)).toBe(0);
    expect(pullDistance(40)).toBe(20);
    expect(pullDistance(1000)).toBe(96);
  });

  it("opens after a deliberate pull, not after a small slip", () => {
    expect(pullDistance(60)).toBeLessThan(PULL_THRESHOLD_PX);
    expect(pullDistance(120)).toBeGreaterThanOrEqual(PULL_THRESHOLD_PX);
  });
});
