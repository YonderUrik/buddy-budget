import { describe, expect, it } from "vitest";
import { distributeColors } from "./distribute-colors";
import { SWATCH_COLORS } from "@/lib/validation/shared-colors";

function ids(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `cat-${i}`);
}

describe("distributeColors", () => {
  it("ritorna un oggetto vuoto per lista vuota", () => {
    expect(distributeColors([])).toEqual({});
  });

  it("assegna il primo colore del pool a una singola categoria", () => {
    const result = distributeColors(ids(1));
    expect(result["cat-0"]).toBe(SWATCH_COLORS[0]);
  });

  it("con 16 categorie assegna tutti i colori base senza ripetizioni", () => {
    const result = distributeColors(ids(16));
    const values = Object.values(result);
    expect(new Set(values).size).toBe(16);
    expect(values).toEqual(SWATCH_COLORS.slice(0, 16));
  });

  it("con 17 categorie usa una variante per la 17esima, distinta dalla precedente", () => {
    const list = ids(17);
    const result = distributeColors(list);
    expect(Object.values(result).length).toBe(17);
    expect(new Set(Object.values(result)).size).toBe(17);
    expect(result[list[16]]).toBe(SWATCH_COLORS[16]);
    expect(result[list[16]]).not.toBe(result[list[15]]);
  });

  it("con 48 categorie usa l'intero pool senza ripetizioni", () => {
    const result = distributeColors(ids(48));
    expect(new Set(Object.values(result)).size).toBe(48);
  });

  it("con 49 categorie il colore si ripete ma mai su elementi adiacenti", () => {
    const list = ids(49);
    const result = distributeColors(list);
    for (let i = 1; i < list.length; i++) {
      expect(result[list[i]]).not.toBe(result[list[i - 1]]);
    }
  });
});
