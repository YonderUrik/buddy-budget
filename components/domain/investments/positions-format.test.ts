import { describe, expect, it } from "vitest";
import type { PositionRow } from "@/lib/calc/investments";
import { concentrationText, priceNote, STALE_AUTO_PRICE_HINT } from "./positions-format";

function row(lastPrice: PositionRow["lastPrice"]): PositionRow {
  return { instrument: { currency: "EUR" }, lastPrice } as unknown as PositionRow;
}

function price(date: string, origin: string): PositionRow["lastPrice"] {
  return { close: 10, date, origin } as unknown as PositionRow["lastPrice"];
}

describe("priceNote", () => {
  it("segnala l'assenza di prezzo", () => {
    expect(priceNote(row(null), "2026-10-04")).toMatchObject({ price: null, stale: true, hint: null });
  });

  it("non segnala un prezzo recente", () => {
    const note = priceNote(row(price("2026-10-02", "automatico")), "2026-10-04");
    expect(note.stale).toBe(false);
    expect(note.hint).toBeNull();
  });

  it("suggerisce il prezzo a mano quando un prezzo automatico è fermo", () => {
    const note = priceNote(row(price("2026-09-20", "automatico")), "2026-10-04");
    expect(note).toMatchObject({ stale: true, hint: STALE_AUTO_PRICE_HINT });
  });

  it("non suggerisce nulla per un prezzo manuale vecchio, ma ne mostra l'origine", () => {
    const note = priceNote(row(price("2026-09-20", "manuale")), "2026-10-04");
    expect(note.stale).toBe(true);
    expect(note.hint).toBeNull();
    expect(note.detail).toContain("manuale");
  });
});

describe("concentrationText", () => {
  it("restituisce null senza lettura", () => {
    expect(concentrationText(null)).toBeNull();
  });
});
