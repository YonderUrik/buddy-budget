import { parseCsv } from "@/lib/investments/import/csv";
import { normalizeHeader } from "@/lib/investments/import/mapping";
import { detectDateOrder, detectDecimalSeparator, parseDate, parseNumber, type DateOrder, type DecimalSeparator } from "@/lib/investments/import/values";
import { isPlausiblePensionDate } from "@/lib/validation/pension";

/** Tabella letta da un file (CSV o Excel): intestazioni e righe di celle già come testo. */
export interface PensionImportTable {
  headers: string[];
  rows: string[][];
  /** Separatore dei decimali da supporre quando i valori non lo rivelano (virgola per i CSV col `;`, punto per Excel). */
  decimalFallback: DecimalSeparator;
}

/** Legge un CSV: separatore riconosciuto da solo. */
export function readCsvTable(text: string): PensionImportTable {
  const { delimiter, headers, rows } = parseCsv(text);
  return { headers, rows, decimalFallback: delimiter === ";" ? "," : "." };
}

/** Campi di una fotografia che una colonna del file può alimentare. */
export const PENSION_IMPORT_FIELDS = ["date", "netContributions", "value"] as const;
export type PensionImportField = (typeof PENSION_IMPORT_FIELDS)[number];

/** Etichette dei campi nella UI (le stesse del form di inserimento). */
export const PENSION_IMPORT_FIELD_LABELS: Record<PensionImportField, string> = {
  date: "Data",
  netContributions: "Contributi netti",
  value: "Controvalore",
};

/** Come leggere un file: quale colonna (indice) alimenta ciascun campo e il formato di date e numeri. */
export interface PensionImportMapping {
  columns: Partial<Record<PensionImportField, number>>;
  dateOrder: DateOrder;
  decimal: DecimalSeparator;
}

/** Intestazioni riconosciute per campo (normalizzate con `normalizeHeader`), in ordine di preferenza. */
const HEADER_SYNONYMS: Record<PensionImportField, string[]> = {
  date: ["data", "date", "datariferimento", "datadiriferimento", "dataposizione", "dataaggiornamento", "datavalore", "datavaluta"],
  netContributions: ["contributinetti", "contributonetto", "netcontributions", "versamentinetti", "totaleversato", "versato", "contributiversati", "contributi", "contributions", "versamenti"],
  value: ["controvalore", "controvaloreattuale", "valoreposizione", "posizionematurata", "posizione", "montante", "saldo", "valore", "value", "balance", "patrimonio"],
};

/** Associa le colonne ai campi per sinonimo: prima le intestazioni uguali, poi quelle che iniziano con un sinonimo lungo. */
export function suggestPensionColumns(headers: string[]): Partial<Record<PensionImportField, number>> {
  const normalized = headers.map(normalizeHeader);
  const used = new Set<number>();
  const columns: Partial<Record<PensionImportField, number>> = {};
  for (const pass of ["exact", "prefix"] as const) {
    for (const field of PENSION_IMPORT_FIELDS) {
      if (columns[field] !== undefined) continue;
      for (const synonym of HEADER_SYNONYMS[field]) {
        const index = normalized.findIndex((h, i) => !used.has(i) && (pass === "exact" ? h === synonym : synonym.length >= 6 && h.startsWith(synonym)));
        if (index >= 0) {
          columns[field] = index;
          used.add(index);
          break;
        }
      }
    }
  }
  return columns;
}

const columnValues = (table: PensionImportTable, column: number | undefined) =>
  column === undefined ? [] : table.rows.map((r) => r[column] ?? "").filter((v) => v.trim() !== "");

/** Mappatura iniziale: colonne per sinonimo e formati di data e numeri dedotti dai valori. */
export function initialPensionMapping(table: PensionImportTable): PensionImportMapping {
  const columns = suggestPensionColumns(table.headers);
  const numbers = [...columnValues(table, columns.netContributions), ...columnValues(table, columns.value)];
  return {
    columns,
    dateOrder: detectDateOrder(columnValues(table, columns.date)),
    decimal: detectDecimalSeparator(numbers, table.decimalFallback),
  };
}

/** Campi indispensabili ancora senza colonna, come messaggi per l'utente. */
export function missingPensionFields(mapping: PensionImportMapping): string[] {
  return PENSION_IMPORT_FIELDS.filter((f) => mapping.columns[f] === undefined).map((f) => PENSION_IMPORT_FIELD_LABELS[f].toLowerCase());
}

/** Fotografia letta da una riga, con il numero di riga del file (1 = intestazioni). */
export interface ImportedSnapshot {
  line: number;
  date: string;
  netContributions: number;
  value: number;
}

export type PensionImportRow = { line: number; status: "ok"; snapshot: ImportedSnapshot } | { line: number; status: "error"; message: string };

/** Importo massimo accettato (come nel form). */
const MAX_AMOUNT = 1e8;

/** Legge ogni riga con la mappatura corrente; le righe non valide diventano errori con il motivo (mai un'eccezione). */
export function normalizePensionRows(table: PensionImportTable, mapping: PensionImportMapping, todayKey: string): PensionImportRow[] {
  const { date, netContributions, value } = mapping.columns;
  if (date === undefined || netContributions === undefined || value === undefined) return [];
  return table.rows.map((cells, i): PensionImportRow => {
    const line = i + 2;
    const isoDate = parseDate(cells[date] ?? "", mapping.dateOrder);
    if (!isoDate) return { line, status: "error", message: "Data non valida" };
    if (!isPlausiblePensionDate(isoDate, todayKey)) return { line, status: "error", message: "Data nel futuro o troppo vecchia" };
    const net = parseNumber(cells[netContributions] ?? "", mapping.decimal);
    const val = parseNumber(cells[value] ?? "", mapping.decimal);
    if (net === null) return { line, status: "error", message: "Contributi netti non validi" };
    if (val === null) return { line, status: "error", message: "Controvalore non valido" };
    if (net < 0 || val < 0 || net > MAX_AMOUNT || val > MAX_AMOUNT) return { line, status: "error", message: "Importo fuori dai limiti" };
    return { line, status: "ok", snapshot: { line, date: isoDate, netContributions: net, value: val } };
  });
}

/** Intestazioni e righe di esempio del modello scaricabile. */
export const PENSION_TEMPLATE_HEADERS = ["Data", "Contributi netti", "Controvalore"];
const PENSION_TEMPLATE_ROWS = [
  ["31/03/2026", "10880,00", "11250,40"],
  ["30/06/2026", "11420,00", "11890,15"],
];

/** Contenuto del modello CSV (separatore `;`, decimali con la virgola, date giorno/mese/anno). */
export function pensionTemplateCsv(): string {
  return [PENSION_TEMPLATE_HEADERS, ...PENSION_TEMPLATE_ROWS].map((r) => r.join(";")).join("\n");
}
