import type { CsvTable } from "./csv";
import { parseCsvRecords } from "./csv";
import { completeMapping, normalizeHeader, suggestColumns, type ImportMapping } from "./mapping";

/** Intestazioni (normalizzate) che identificano il «Movimenti Dossier Titoli» di Fineco, qualunque sia la riga in cui iniziano. */
const FINECO_HEADERS = ["operazione", "datavaluta", "descrizione", "titolo", "isin", "segno", "quantita", "divisa", "prezzo", "controvalore"];

/** Intestazioni della tabella già pulita che il resto dell'import sa mappare da solo. */
export const FINECO_TABLE_HEADERS = ["Data", "Tipo", "ISIN", "Nome", "Quantità", "Prezzo", "Controvalore", "Commissioni", "Valuta"];

/** Righe di intestazione lette al massimo prima di arrendersi (il file ha un'intestazione di dossier sopra la tabella). */
const HEADER_SCAN_ROWS = 30;

const COL = { date: 0, description: 2, name: 3, isin: 4, sign: 5, quantity: 6, currency: 7, price: 8, total: 10, fees: 11 } as const;

function findHeaderRow(records: string[][]): number {
  const limit = Math.min(records.length, HEADER_SCAN_ROWS);
  for (let i = 0; i < limit; i += 1) {
    const present = new Set(records[i].map(normalizeHeader));
    if (FINECO_HEADERS.every((h) => present.has(h))) return i;
  }
  return -1;
}

function recordsOf(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const delimiter = clean.slice(0, 4000).split("\n").some((l) => l.includes(";")) ? ";" : ",";
  return parseCsvRecords(clean, delimiter).map((r) => r.cells.map((c) => c.trim()));
}

/** Il file è un «Movimenti Dossier Titoli» di Fineco (CSV, o foglio Excel già convertito in testo)? */
export function looksLikeFineco(text: string): boolean {
  try {
    return findHeaderRow(recordsOf(text.slice(0, 20_000))) >= 0;
  } catch {
    return false;
  }
}

/** Celle di un foglio → testo CSV con `;`, per farlo passare dallo stesso percorso di un file CSV. */
export function gridToCsv(grid: string[][]): string {
  const quote = (cell: string) => (/[;"\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);
  return grid.map((row) => row.map(quote).join(";")).join("\n");
}

/** `1.062,02` / `3,00` / `105.179` → numero col punto decimale; testo non numerico resta com'è (segnalato poi come errore). */
function plainNumber(value: string): string {
  const v = value.trim();
  if (v.includes(",")) return v.replace(/\./g, "").replace(",", ".");
  return v;
}

/** `02/12/2024` o `2024-12-02` → `2024-12-02`; altro resta com'è (segnalato poi come data non valida). */
function isoDate(value: string): string {
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return value;
}

/** Tipo di operazione dalla descrizione e dal segno; qualunque altra cosa resta col suo testo e viene ignorata con un messaggio. */
function operationType(description: string, sign: string): string {
  const d = description.toLowerCase();
  if (d.includes("compravendita")) return sign.toUpperCase() === "A" ? "Acquisto" : sign.toUpperCase() === "V" ? "Vendita" : description;
  if (d.includes("dividend")) return "Dividendo";
  if (d.includes("cedol")) return "Cedola";
  return description;
}

/**
 * Tabella pulita del file Fineco: salta l'intestazione del dossier, usa la data dell'operazione (non la data valuta),
 * traduce Segno A/V in Acquisto/Vendita, porta numeri e date al formato neutro. Le righe vuote si scartano; quelle
 * non riconosciute restano e finiscono tra gli avvisi dell'anteprima.
 */
export function parseFinecoTable(text: string): CsvTable {
  const records = recordsOf(text);
  const at = findHeaderRow(records);
  if (at < 0) throw new Error("Non trovo la tabella dei movimenti: serve l'export «Movimenti Dossier Titoli» di Fineco");
  const rows = records
    .slice(at + 1)
    .filter((r) => r.some((c) => c !== ""))
    .map((r) => {
      const cell = (i: number) => r[i] ?? "";
      const foreign = cell(COL.currency);
      return [
        isoDate(cell(COL.date)),
        operationType(cell(COL.description), cell(COL.sign)),
        cell(COL.isin).toUpperCase(),
        cell(COL.name),
        plainNumber(cell(COL.quantity)),
        plainNumber(cell(COL.price)),
        plainNumber(cell(COL.total)),
        plainNumber(cell(COL.fees)),
        foreign,
      ];
    });
  return { delimiter: ";", headers: FINECO_TABLE_HEADERS, rows };
}

/** Mappatura già pronta per la tabella pulita (date ISO, decimali col punto, tipi tradotti). */
export function finecoMapping(table: CsvTable): ImportMapping {
  return completeMapping(table, suggestColumns(table.headers), {
    dateOrder: "ymd",
    decimal: ".",
    symbolIsYahoo: false,
    typeValues: { acquisto: "acquisto", vendita: "vendita", dividendo: "dividendo", cedola: "cedola" },
  });
}
