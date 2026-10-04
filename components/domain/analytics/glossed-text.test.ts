import { describe, expect, it } from "vitest";
import { GLOSSARY, GLOSSARY_MATCHES } from "./glossary";

describe("glossario", () => {
  it("ogni forma riconoscibile punta a un termine esistente ed è in minuscolo", () => {
    for (const m of GLOSSARY_MATCHES) {
      expect(GLOSSARY[m.id]).toBeDefined();
      expect(m.phrase).toBe(m.phrase.toLowerCase());
    }
  });
  it("le forme più lunghe vengono prima (così «tasso di prelievo» non cede a una parola più corta)", () => {
    const lengths = GLOSSARY_MATCHES.map((m) => m.phrase.length);
    expect([...lengths].sort((a, b) => b - a)).toEqual(lengths);
  });
  it("ogni voce ha titolo e spiegazione", () => {
    for (const e of Object.values(GLOSSARY)) {
      expect(e.title.length).toBeGreaterThan(2);
      expect(e.text.length).toBeGreaterThan(30);
    }
  });
});
