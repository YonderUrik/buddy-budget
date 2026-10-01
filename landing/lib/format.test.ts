import { describe, expect, it } from "vitest";
import { eur, groupThousands } from "./format";

describe("format", () => {
  it("raggruppa sempre le migliaia con il punto", () => {
    expect(groupThousands(4732)).toBe("4.732");
    expect(groupThousands(47320)).toBe("47.320");
    expect(groupThousands(-1234567)).toBe("-1.234.567");
    expect(groupThousands(999)).toBe("999");
  });
  it("formatta gli euro", () => expect(eur(1500.4)).toBe("1.500 €"));
});
