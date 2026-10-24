import { describe, expect, it } from "vitest";
import { COMPACT_DISTANCE_PX, COMPACT_TOP_ZONE_PX, INITIAL_COMPACT_STATE, nextCompactState, type CompactScrollState } from "./compact-on-scroll";

const MAX = 5000;

function scrollThrough(offsets: number[], start: CompactScrollState = INITIAL_COMPACT_STATE): CompactScrollState {
  return offsets.reduce((state, y) => nextCompactState(state, y, MAX), start);
}

describe("nextCompactState", () => {
  it("stays full inside the top zone, whatever the direction", () => {
    expect(scrollThrough([10, 30, COMPACT_TOP_ZONE_PX]).compact).toBe(false);
  });

  it("shrinks after scrolling down past the top zone", () => {
    expect(scrollThrough([100, 200, 300]).compact).toBe(true);
  });

  it("ignores small jitters in both states", () => {
    const compact = scrollThrough([100, 300]);
    expect(nextCompactState(compact, 300 - COMPACT_DISTANCE_PX + 1, MAX).compact).toBe(true);
    const full = scrollThrough([100, 300, 200]);
    expect(full.compact).toBe(false);
    expect(nextCompactState(full, 200 + COMPACT_DISTANCE_PX - 1, MAX).compact).toBe(false);
  });

  it("grows back after scrolling up, measured from the lowest point reached", () => {
    const state = scrollThrough([100, 400, 600, 590]);
    expect(state.compact).toBe(true);
    expect(nextCompactState(state, 600 - COMPACT_DISTANCE_PX, MAX).compact).toBe(false);
  });

  it("grows back at the top", () => {
    expect(scrollThrough([100, 400, 20]).compact).toBe(false);
  });

  it("keeps the state in the bounce at the bottom of the page", () => {
    const state = scrollThrough([100, 400, MAX]);
    expect(state.compact).toBe(true);
    expect(nextCompactState(state, MAX - COMPACT_DISTANCE_PX / 2, MAX).compact).toBe(true);
  });

  it("never shrinks a page too short to leave the top zone", () => {
    expect(scrollThrough([20, 40], INITIAL_COMPACT_STATE).compact).toBe(false);
  });
});
