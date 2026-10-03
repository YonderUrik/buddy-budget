/** Separatori di colonna provati quando il file non lo dichiara. */
export const CSV_DELIMITERS = [",", ";", "\t", "|"] as const;
export type CsvDelimiter = (typeof CSV_DELIMITERS)[number];

/** Righe lette per indovinare il separatore. */
const DELIMITER_SAMPLE_LINES = 10;

/** Tabella letta da un file: intestazioni e righe di celle (già senza virgolette). */
export interface CsvTable {
  delimiter: CsvDelimiter;
  headers: string[];
  rows: string[][];
}

/** Divide il testo in righe logiche, rispettando i campi tra virgolette che contengono a capo. */
export function parseCsvRecords(text: string, delimiter = ",", strict = false): { line: number; cells: string[] }[] {
  const records: { line: number; cells: string[] }[] = [];
  let line = 1;
  let startLine = 1;
  let closed = false;
  let record: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
        closed = true;
      } else {
        field += char;
        if (char === "\n" || (char === "\r" && text[i + 1] !== "\n")) line += 1;
      }
      continue;
    }
    if (strict && closed && char !== delimiter && char !== "\n" && char !== "\r") throw new Error(`CSV non valido alla riga ${line}`);
    if (strict && char === '"' && field !== "") throw new Error(`CSV non valido alla riga ${line}`);
    if (char === '"' && field === "") quoted = true;
    else if (char === delimiter) {
      record.push(field);
      field = "";
      closed = false;
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      record.push(field);
      records.push({ line: startLine, cells: record });
      line += 1;
      startLine = line;
      closed = false;
      record = [];
      field = "";
    } else field += char;
  }
  if (strict && quoted) throw new Error(`Virgolette CSV non chiuse alla riga ${startLine}`);
  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push({ line: startLine, cells: record });
  }
  return records;
}

function splitRecords(text: string, delimiter: string): string[][] {
  return parseCsvRecords(text, delimiter).map((record) => record.cells);
}

/**
 * Separatore più probabile: quello che dà lo stesso numero di colonne (più di una) sulle prime righe.
 * A parità vince chi ne dà di più. Serve per i CSV "all'italiana" col punto e virgola.
 */
export function detectDelimiter(text: string): CsvDelimiter {
  const sample = text.split(/\r?\n/).filter((l) => l.trim() !== "").slice(0, DELIMITER_SAMPLE_LINES).join("\n");
  let best: { delimiter: CsvDelimiter; score: number } = { delimiter: ",", score: -1 };
  for (const delimiter of CSV_DELIMITERS) {
    const counts = splitRecords(sample, delimiter).map((r) => r.length);
    if (counts.length === 0 || counts[0] < 2) continue;
    const consistent = counts.filter((c) => c === counts[0]).length / counts.length;
    const score = consistent * 100 + counts[0];
    if (score > best.score) best = { delimiter, score };
  }
  return best.delimiter;
}

/** Legge un CSV: toglie il BOM, indovina il separatore, scarta le righe vuote e taglia gli spazi delle celle. */
export function parseCsv(text: string, delimiter?: CsvDelimiter): CsvTable {
  const clean = text.replace(/^﻿/, "");
  const chosen = delimiter ?? detectDelimiter(clean);
  const records = splitRecords(clean, chosen)
    .map((r) => r.map((cell) => cell.trim()))
    .filter((r) => r.some((cell) => cell !== ""));
  const [headers = [], ...rows] = records;
  return { delimiter: chosen, headers, rows };
}
