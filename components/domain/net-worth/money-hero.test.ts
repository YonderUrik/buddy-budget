import { describe, expect, it } from "vitest";
import { splitMoney } from "./money-hero";

describe("splitMoney", () => {
  it("separa parte intera e decimali in italiano", () => {
    const { main, tail } = splitMoney(30673.12, "EUR");
    expect(main).toBe("30.673");
    expect(tail.replace(/\s/g, " ")).toBe(",12 €");
  });
  it("tiene la valuta davanti con la parte grande", () => {
    expect(splitMoney(1234.5, "USD", "en-US")).toEqual({ main: "$1,234", tail: ".50" });
  });
});
