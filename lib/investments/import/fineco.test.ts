import { describe, expect, it } from "vitest";
import { finecoMapping, gridToCsv, looksLikeFineco, parseFinecoTable } from "./fineco";
import { normalizeRows } from "./normalize";
import { detectImportProvider } from "./providers";

const HEADER = ["Operazione", "Data valuta", "Descrizione", "Titolo", "Isin", "Segno", "Quantita", "Divisa", "Prezzo", "Cambio", "Controvalore", "Commissioni amministrato"];
// Dati inventati.
const GRID = [
  ["Dossier n.: 0000000"],
  ["Intestazione Dossier: MARIO ROSSI"],
  [],
  ["RISULTATO RICERCA MOVIMENTI TITOLI"],
  [],
  HEADER,
  [],
  ["02/12/2024", "04/12/2024", "Compravendita titoli", "ETF WORLD", "IE00B4L5Y983", "A", "3,00", "EUR", "105,17900", "1,00000", "315,54", "0,00"],
  ["03/01/2025", "07/01/2025", "Compravendita titoli", "ETF WORLD", "IE00B4L5Y983", "V", "1,00", "EUR", "1.062,50000", "1,00000", "1.062,50", "2,95"],
  ["10/01/2025", "10/01/2025", "Dividendi", "ETF WORLD", "IE00B4L5Y983", "A", "", "EUR", "", "1,00000", "12,40", "0,00"],
  ["11/01/2025", "11/01/2025", "Imposta di bollo", "", "", "", "", "EUR", "", "", "5,00", ""],
  ["31/02/2025", "", "Compravendita titoli", "ETF WORLD", "IE00B4L5Y983", "A", "1,00", "EUR", "10,00", "1,00000", "10,00", "0,00"],
];
const TEXT = gridToCsv(GRID.map((r) => (r.length ? r : [""])));

describe("Fineco", () => {
  it("riconosce il file anche con l'intestazione del dossier sopra la tabella", () => {
    expect(looksLikeFineco(TEXT)).toBe(true);
    expect(detectImportProvider(TEXT)).toBe("fineco");
    expect(looksLikeFineco("Data;Tipo;ISIN\n01/01/2025;Acquisto;IE00B4L5Y983")).toBe(false);
  });

  it("legge acquisti, vendite con migliaia, dividendi e avvisa sul resto", () => {
    const table = parseFinecoTable(TEXT);
    const rows = normalizeRows(table, finecoMapping(table), "2026-01-01");
    expect(rows[0]).toMatchObject({ status: "ok", identity: { isin: "IE00B4L5Y983", currency: "EUR" }, operation: { type: "acquisto", date: "2024-12-02", quantity: 3, price: 105.179, fees: 0 } });
    expect(rows[1]).toMatchObject({ status: "ok", operation: { type: "vendita", date: "2025-01-03", price: 1062.5, fees: 2.95 } });
    expect(rows[2]).toMatchObject({ status: "ok", operation: { type: "dividendo", grossAmount: 12.4 } });
    expect(rows[3]).toMatchObject({ status: "skipped", message: expect.stringContaining("Imposta di bollo") });
    expect(rows[4]).toMatchObject({ status: "error", message: expect.stringContaining("non valida") });
  });

  it("accetta le date già ISO e i numeri di Excel col punto", () => {
    const grid = [HEADER, ["2025-01-03", "", "Compravendita titoli", "X", "IE00B4L5Y983", "A", "2", "EUR", "10.5", "1", "21", "0"]];
    const table = parseFinecoTable(gridToCsv(grid));
    const [row] = normalizeRows(table, finecoMapping(table), "2026-01-01");
    expect(row).toMatchObject({ status: "ok", operation: { date: "2025-01-03", quantity: 2, price: 10.5 } });
  });

  it("rifiuta un file senza la tabella dei movimenti", () => {
    expect(() => parseFinecoTable("a;b\n1;2")).toThrow(/Movimenti Dossier Titoli/);
  });
});
