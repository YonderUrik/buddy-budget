import { describe, expect, it } from "vitest";
import { correlationLabel, correlationPairs, overlapLabel } from "./plain-labels";

describe("overlapLabel", () => {
  it("distingue doppione, buona parte e parte in comune", () => {
    expect(overlapLabel(0.95).severity).toBe("alta");
    expect(overlapLabel(0.6).severity).toBe("media");
    expect(overlapLabel(0.3).severity).toBe("bassa");
  });
});

describe("correlationLabel", () => {
  it("usa le soglie e tratta le negative come indipendenti", () => {
    expect(correlationLabel(0.9).severity).toBe("alta");
    expect(correlationLabel(0.6).severity).toBe("media");
    expect(correlationLabel(0.3).label).toBe("Si muovono poco insieme");
    expect(correlationLabel(-0.4).label).toBe("Indipendenti");
  });
});

describe("correlationPairs", () => {
  it("ordina le coppie dalla più legata e salta i valori mancanti", () => {
    const pairs = correlationPairs({
      instrumentIds: ["a", "b", "c"],
      values: [
        [1, 0.2, 0.9],
        [0.2, 1, null],
        [0.9, null, 1],
      ],
    });
    expect(pairs).toEqual([
      { aId: "a", bId: "c", value: 0.9 },
      { aId: "a", bId: "b", value: 0.2 },
    ]);
  });
});
