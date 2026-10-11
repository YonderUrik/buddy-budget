import { describe, expect, it } from "vitest";
import { sectionOf } from "./section-transition";

describe("sectionOf", () => {
  it("prende il primo segmento del percorso", () => {
    expect(sectionOf("/liquidita/conti")).toBe("liquidita");
    expect(sectionOf("/liquidita")).toBe("liquidita");
    expect(sectionOf("/investimenti/titoli/VWCE")).toBe("investimenti");
  });

  it("restituisce una stringa vuota per la radice", () => {
    expect(sectionOf("/")).toBe("");
  });
});
