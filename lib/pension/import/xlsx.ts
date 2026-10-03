import { strFromU8, unzipSync } from "fflate";
import type { PensionImportTable } from "./mapping";

/** Dimensione massima del file Excel accettato (un foglio di fotografie ne pesa pochi KB). */
export const XLSX_MAX_FILE_BYTES = 5 * 1024 * 1024;
/** Dimensione massima di una parte del file una volta decompressa: ferma i file "bomba" prima di aprirli. */
const XLSX_MAX_PART_BYTES = 20 * 1024 * 1024;
/** Righe lette al massimo da un foglio. */
export const XLSX_MAX_ROWS = 5000;

/** Giorni tra il 1899-12-30 (origine dei numeri di serie di Excel) e il 1970-01-01. */
const EXCEL_EPOCH_OFFSET_DAYS = 25569;
const MS_PER_DAY = 86_400_000;
/** Formati data predefiniti di Excel (id in `numFmtId` senza `formatCode`). */
const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

const decodeEntities = (text: string) =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const attr = (tag: string, name: string): string | null => {
  const match = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag);
  return match ? decodeEntities(match[1]) : null;
};

/** Testo di un elemento: unisce tutti i `<t>` (anche quelli del testo formattato a pezzi). */
const textOf = (xml: string) => decodeEntities([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""));

/** Indice di colonna (da 0) da un riferimento di cella come `C12`. */
function columnIndex(ref: string): number {
  let index = 0;
  for (const char of ref.replace(/[^A-Z]/gi, "").toUpperCase()) index = index * 26 + char.charCodeAt(0) - 64;
  return index - 1;
}

/** Numero di serie Excel → `YYYY-MM-DD` (la parte frazionaria, l'orario, si scarta). */
export function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1) return null;
  const date = new Date(Math.floor(serial - EXCEL_EPOCH_OFFSET_DAYS) * MS_PER_DAY);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

const isDateFormatCode = (code: string) => /[dmy]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, ""));

/** Per ogni stile di cella, se è un formato data. */
function dateStyles(stylesXml: string | undefined): boolean[] {
  if (!stylesXml) return [];
  const custom = new Map<number, boolean>();
  for (const m of stylesXml.matchAll(/<numFmt\s[^>]*>/g)) {
    const id = Number(attr(m[0], "numFmtId"));
    custom.set(id, isDateFormatCode(attr(m[0], "formatCode") ?? ""));
  }
  const cellXfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml)?.[1] ?? "";
  return [...cellXfs.matchAll(/<xf\s[^>]*>/g)].map((m) => {
    const id = Number(attr(m[0], "numFmtId"));
    return custom.get(id) ?? BUILTIN_DATE_FORMATS.has(id);
  });
}

function sharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  return [...xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
}

/** Percorso del primo foglio: quello che `workbook.xml` elenca per primo, altrimenti `sheet1.xml`. */
function firstSheetPath(files: Record<string, Uint8Array>): string | null {
  const workbook = files["xl/workbook.xml"] && strFromU8(files["xl/workbook.xml"]);
  const rels = files["xl/_rels/workbook.xml.rels"] && strFromU8(files["xl/_rels/workbook.xml.rels"]);
  const sheetTag = workbook ? /<sheet\s[^>]*>/.exec(workbook)?.[0] : undefined;
  const rid = sheetTag ? attr(sheetTag, "r:id") : null;
  if (rid && rels) {
    for (const m of rels.matchAll(/<Relationship\s[^>]*>/g)) {
      const target = attr(m[0], "Target");
      if (attr(m[0], "Id") === rid && target) {
        const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
        if (files[path]) return path;
      }
    }
  }
  return Object.keys(files).sort().find((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)) ?? null;
}

/**
 * Legge il primo foglio di un file `.xlsx` come tabella di testo: la prima riga non vuota è l'intestazione. Le date
 * (celle con formato data) diventano `YYYY-MM-DD`, i numeri restano numeri con il punto decimale. Lancia con un
 * messaggio per l'utente se il file non è un `.xlsx` leggibile. Non si fida del file: tetto alle dimensioni e alle righe.
 */
export function readXlsx(data: Uint8Array): PensionImportTable {
  if (data.byteLength > XLSX_MAX_FILE_BYTES) throw new Error("Il file Excel è troppo grande");
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data, {
      filter: (file) =>
        file.originalSize <= XLSX_MAX_PART_BYTES &&
        (file.name === "xl/sharedStrings.xml" || file.name === "xl/styles.xml" || file.name.startsWith("xl/worksheets/sheet") || file.name.startsWith("xl/workbook.xml") || file.name === "xl/_rels/workbook.xml.rels"),
    });
  } catch {
    throw new Error("Il file non è un Excel (.xlsx) valido. I vecchi .xls vanno salvati come .xlsx o CSV");
  }
  const sheetPath = firstSheetPath(files);
  if (!sheetPath) throw new Error("Non trovo nessun foglio nel file Excel");

  const strings = sharedStrings(files["xl/sharedStrings.xml"] && strFromU8(files["xl/sharedStrings.xml"]));
  const dateStyle = dateStyles(files["xl/styles.xml"] && strFromU8(files["xl/styles.xml"]));
  const sheet = strFromU8(files[sheetPath]);

  const grid: string[][] = [];
  for (const rowMatch of sheet.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const row: string[] = [];
    for (const cellMatch of (rowMatch[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const head = cellMatch[1];
      const body = cellMatch[2] ?? "";
      const ref = attr(head, "r");
      const type = attr(head, "t");
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "";
      let text = "";
      if (type === "s") text = strings[Number(raw)] ?? "";
      else if (type === "inlineStr") text = textOf(body);
      else if (type === "str" || type === "e" || type === "b") text = decodeEntities(raw);
      else if (raw !== "") {
        const number = Number(raw);
        const style = Number(attr(head, "s") ?? 0);
        text = dateStyle[style] ? (excelSerialToIso(number) ?? raw) : Number.isFinite(number) ? String(number) : raw;
      }
      const column = ref ? columnIndex(ref) : row.length;
      while (row.length < column) row.push("");
      row[column] = text.trim();
    }
    grid.push(row);
    if (grid.length > XLSX_MAX_ROWS + 1) throw new Error(`Il foglio ha troppe righe: al massimo ${XLSX_MAX_ROWS}`);
  }

  const records = grid.filter((r) => r.some((cell) => cell !== ""));
  const [headers = [], ...rows] = records;
  return { headers, rows, decimalFallback: "." };
}
