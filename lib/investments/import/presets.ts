import type { CsvTable } from "./csv";
import { completeMapping, normalizeHeader, suggestColumns, type ImportMapping } from "./mapping";

/**
 * Formato di file conosciuto: si riconosce dalle intestazioni e aggiusta la mappatura dedotta per sinonimi con ciò
 * che le intestazioni non dicono (es. i simboli di Yahoo sono già ticker Yahoo). Per aggiungere un broker basta un
 * elemento in `IMPORT_PRESETS`; i formati non elencati passano comunque dalla mappatura automatica + manuale.
 */
export interface ImportPreset {
  id: string;
  label: string;
  /** Intestazioni (normalizzate con `normalizeHeader`) che devono esserci tutte. */
  requiredHeaders: string[];
  /** Aggiustamenti alla mappatura dedotta. */
  adjust(table: CsvTable, mapping: ImportMapping): ImportMapping;
}

/** Colonne del modello di file BuddyBudget, per chi esporta da un broker non riconosciuto. */
export const TEMPLATE_HEADERS = ["Data", "Tipo", "ISIN", "Simbolo", "Nome", "Quantità", "Prezzo", "Controvalore", "Commissioni", "Imposte", "Valuta", "Note"];

/** Righe di esempio del modello. */
const TEMPLATE_EXAMPLE_ROWS = [
  ["15/01/2026", "Acquisto", "IE00B4L5Y983", "SWDA.MI", "iShares Core MSCI World", "10", "104,50", "", "2,95", "0", "EUR", ""],
  ["20/03/2026", "Dividendo", "IT0003128367", "ENEL.MI", "Enel", "", "", "12,40", "0", "3,22", "EUR", "Dividendo lordo nel controvalore"],
];

/** Contenuto del modello CSV scaricabile (separatore `;`, decimali con la virgola). */
export function templateCsv(): string {
  return [TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLE_ROWS].map((r) => r.join(";")).join("\n");
}

export const IMPORT_PRESETS: ImportPreset[] = [
  {
    id: "yahoo-portfolio",
    label: "Yahoo Finance · portafoglio",
    requiredHeaders: ["symbol", "tradedate", "purchaseprice", "quantity"],
    adjust: (_table, mapping) => ({
      ...mapping,
      dateOrder: "ymd",
      decimal: ".",
      symbolIsYahoo: true,
      typeValues: { buy: "acquisto", sell: "vendita", ...mapping.typeValues },
    }),
  },
  {
    id: "buddybudget-template",
    label: "Modello BuddyBudget",
    requiredHeaders: TEMPLATE_HEADERS.map(normalizeHeader),
    adjust: (_table, mapping) => ({ ...mapping, dateOrder: "dmy", decimal: ",", symbolIsYahoo: true }),
  },
];

/** Formato riconosciuto dalle intestazioni, o null. */
export function detectPreset(headers: string[]): ImportPreset | null {
  const present = new Set(headers.map(normalizeHeader));
  return IMPORT_PRESETS.find((p) => p.requiredHeaders.every((h) => present.has(h))) ?? null;
}

/** Mappatura iniziale di un file: per sinonimi, poi aggiustata dal formato riconosciuto se c'è. */
export function initialMapping(table: CsvTable): { mapping: ImportMapping; preset: ImportPreset | null } {
  const preset = detectPreset(table.headers);
  const base = completeMapping(table, suggestColumns(table.headers));
  return { mapping: preset ? preset.adjust(table, base) : base, preset };
}
