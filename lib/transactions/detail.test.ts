import { describe, expect, it } from "vitest";
import { merchantWindowStart, personalFormatId, summarizeMerchant, transactionOrigin } from "./detail";
import { localizedDetailText, longDateWithWeekday } from "./detail-text";

describe("transactionOrigin", () => {
  it("names the bank for synced transactions", () => {
    expect(transactionOrigin({ source: "auto", externalId: "gc-1", accountIsDemo: false }, { institution: "Intesa Sanpaolo" })).toEqual({ kind: "banca", institution: "Intesa Sanpaolo" });
  });

  it("tells file imports, broker statements, sample data and hand-typed rows apart", () => {
    expect(transactionOrigin({ source: "manuale", externalId: "personal:f1:row-3", accountIsDemo: false }, { format: "Estratto Intesa" })).toEqual({ kind: "file", format: "Estratto Intesa" });
    expect(transactionOrigin({ source: "manuale", externalId: "trade-republic:abc", accountIsDemo: false })).toEqual({ kind: "broker", broker: "Trade Republic" });
    expect(transactionOrigin({ source: "auto", externalId: "x", accountIsDemo: true })).toEqual({ kind: "esempio" });
    expect(transactionOrigin({ source: "manuale", externalId: null, accountIsDemo: false })).toEqual({ kind: "manuale" });
  });

  it("reads the format id of a personal import", () => {
    expect(personalFormatId("personal:5f0c:row-1")).toBe("5f0c");
    expect(personalFormatId("trade-republic:1")).toBeNull();
    expect(personalFormatId(null)).toBeNull();
  });
});

describe("summarizeMerchant", () => {
  const row = (id: string, date: string, description: string, amount: number, excludedAmount = 0) => ({ id, date, description, amount: String(amount), excludedAmount: String(excludedAmount) });

  it("counts the same merchant and direction, totals the counted part and lists the others newest first", () => {
    const current = row("c", "2026-10-10", "PAGAMENTO POS ESSELUNGA 123", -40);
    const rows = [
      current,
      row("a", "2026-08-01", "Esselunga", -20, -5),
      row("b", "2026-09-15", "ESSELUNGA S.P.A.", -30),
      row("r", "2026-09-20", "Esselunga", 12), // refund: other direction
      row("x", "2026-09-21", "Coop", -50),
    ];
    expect(summarizeMerchant(current, rows)).toEqual({
      count: 3,
      total: -85,
      recent: [
        { id: "b", date: "2026-09-15", amount: -30 },
        { id: "a", date: "2026-08-01", amount: -15 },
      ],
    });
  });

  it("says nothing for a merchant seen once", () => {
    const current = row("c", "2026-10-10", "Ferramenta Rossi", -12);
    expect(summarizeMerchant(current, [current])).toBeNull();
  });

  it("starts the window one year back", () => {
    expect(merchantWindowStart(new Date("2026-10-19T10:00:00Z"))).toBe("2025-10-19");
  });
});

describe("localizedDetailText", () => {
  const it_ = localizedDetailText("it");

  it("explains where a transaction came from", () => {
    expect(it_.originText({ kind: "banca", institution: "Fineco" })).toBe("Dalla banca collegata, Fineco");
    expect(it_.originText({ kind: "file", format: null })).toBe("Da un file importato");
    expect(it_.originText({ kind: "manuale" })).toBe("Aggiunto da te");
  });

  it("names the rule that set the category", () => {
    expect(it_.categoryOriginText("regola", null, { id: "r", matchType: "merchant", pattern: "esselunga" }, false)).toBe("Messa dalla tua regola per «esselunga»");
    expect(it_.categoryOriginText("utente", null, null, false)).toBe("Scelta da te");
    expect(it_.categoryOriginText("regola", null, null, true)).toBeNull();
    expect(it_.categoryOriginText(null, null, null, false)).toBeNull();
  });

  it("translates into English", () => {
    expect(localizedDetailText("en").originText({ kind: "manuale" })).not.toBe("Aggiunto da te");
  });

  it("writes the long date with the weekday", () => {
    expect(longDateWithWeekday("2026-10-19", "it-IT")).toBe("lunedì 19 ottobre 2026");
  });
});
