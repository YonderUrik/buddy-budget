import { describe, expect, it } from "vitest";
import { ibListingToFigi } from "./exchanges";

describe("IB listing exchanges", () => {
  it("maps the exchanges of a real statement to the listings the app links", () => {
    expect(ibListingToFigi("NASDAQ")).toBe("US");
    expect(ibListingToFigi("AEB")).toBe("NA");
    expect(ibListingToFigi("IBIS2")).toBe("GY");
    expect(ibListingToFigi("bvme.etf")).toBe("IM");
  });
  it("leaves exchanges the app does not link to the default order", () => {
    expect(ibListingToFigi("VALUE")).toBeNull();
    expect(ibListingToFigi("")).toBeNull();
    expect(ibListingToFigi(null)).toBeNull();
  });
});
