import { describe, expect, it } from "vitest";
import { springEasing } from "./springs";

describe("springEasing", () => {
  it("parte da 0, finisce esattamente a 1 e dura meno di 4 secondi", () => {
    const { easing, duration } = springEasing(320, 30);
    const points = easing.slice("linear(".length, -1).split(",").map(Number);
    expect(points[0]).toBe(0);
    expect(points.at(-1)).toBe(1);
    expect(duration).toBeGreaterThan(100);
    expect(duration).toBeLessThan(4000);
  });
  it("una molla poco smorzata supera 1 prima di fermarsi", () => {
    const points = springEasing(400, 10).easing.slice("linear(".length, -1).split(",").map(Number);
    expect(Math.max(...points)).toBeGreaterThan(1);
  });
});
