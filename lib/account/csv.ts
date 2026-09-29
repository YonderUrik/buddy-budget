/**
 * CSV pensati per Excel in italiano: separatore `;`, decimali con la virgola, BOM UTF-8 per gli accenti.
 * I valori che iniziano con `= + - @` vengono prefissati con un apostrofo per evitare formula injection
 * (una descrizione bancaria non deve poter diventare una formula), tranne i numeri veri.
 */
export const CSV_SEPARATOR = ";";
const BOM = "﻿";
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export type CsvValue = string | number | boolean | null | undefined | Date;

export interface CsvColumn<Row> {
  header: string;
  value: (row: Row) => CsvValue;
}

function formatCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return Number.isFinite(value) ? String(value).replace(".", ",") : "";
  if (typeof value === "boolean") return value ? "sì" : "no";
  const text = FORMULA_PREFIX.test(value) && !/^-?\d+([.,]\d+)?$/.test(value) ? `'${value}` : value;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Numero decimale salvato come stringa (colonne `numeric` di Postgres) formattato con la virgola. */
export function decimal(value: string | null | undefined): string {
  return value === null || value === undefined ? "" : value.replace(".", ",");
}

/** Costruisce il CSV (con intestazione e BOM) di `rows` secondo `columns`. */
export function toCsv<Row>(rows: readonly Row[], columns: readonly CsvColumn<Row>[]): string {
  const lines = [columns.map((c) => formatCell(c.header)).join(CSV_SEPARATOR)];
  for (const row of rows) {
    lines.push(columns.map((c) => formatCell(c.value(row))).join(CSV_SEPARATOR));
  }
  return `${BOM}${lines.join("\r\n")}\r\n`;
}
