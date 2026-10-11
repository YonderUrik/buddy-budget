import { describe, expect, it } from "vitest";
import { describeHistory } from "./connect-bank-flow";

describe("describeHistory", () => {
  it("usa i giorni sotto l'anno e gli anni sopra", () => {
    expect(describeHistory("90")).toBe("Storico fino a 90 giorni");
    expect(describeHistory("365")).toBe("Storico fino a 1 anno");
    expect(describeHistory("730")).toBe("Storico fino a 2 anni");
  });
  it("ignora valori non validi", () => {
    expect(describeHistory("")).toBeNull();
    expect(describeHistory("abc")).toBeNull();
    expect(describeHistory("0")).toBeNull();
  });
});
