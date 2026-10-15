import { describe, expect, it } from "vitest";
import { groupErrorsByReason, sourceLine, sourceText } from "./review-groups";
import { skipErrorRecords } from "./confirm";
import { describeRowErrors } from "./contract";
import type { PreviewRecord } from "./confirm";

const error = (row: number, reason: string, line?: number): PreviewRecord => ({ key: `k${row}`, source: [`riga ${row}`], line, outcome: { row, kind: "error", reason }, rate: null });
const cash = (row: number): PreviewRecord => ({ key: `k${row}`, source: [`riga ${row}`], outcome: { row, kind: "cash", date: "2024-01-01", currency: "EUR", description: "x", amount: 1, transfer: false }, rate: 1 });

describe("review-groups", () => {
  it("raggruppa per motivo, dal più numeroso, e ignora le righe riconosciute", () => {
    const groups = groupErrorsByReason([error(0, "Data mancante"), cash(1), error(2, "Importo non valido"), error(3, "Importo non valido"), error(4, " Data mancante ")]);
    expect(groups.map((g) => [g.reason, g.records.length])).toEqual([["Data mancante", 2], ["Importo non valido", 2]]);
  });
  it("usa la riga del file quando c'è, altrimenti l'indice più uno", () => {
    expect(sourceLine(error(4, "x", 12))).toBe(12);
    expect(sourceLine(error(4, "x"))).toBe(5);
    expect(sourceText(error(4, "x"))).toBe("riga 4");
  });
  it("saltare le righe le rende escluse con il motivo, e lascia le altre intatte", () => {
    const { records, skippedKeys } = skipErrorRecords([cash(0), error(1, "Riga incompleta")]);
    expect([...skippedKeys]).toEqual(["k1"]);
    expect(records[1].outcome).toEqual({ row: 1, kind: "ignore", reason: "Saltata: Riga incompleta" });
    expect(records[0]).toBe(records[0]);
  });
  it("il messaggio dice quante righe su quante e cosa si può fare", () => {
    expect(describeRowErrors(1, 5)).toBe("1 riga su 5 non è stata riconosciuta. Puoi importare le altre 4, rianalizzare il file o caricarne uno corretto.");
    expect(describeRowErrors(3, 3)).toContain("Rianalizza il file");
  });
});
