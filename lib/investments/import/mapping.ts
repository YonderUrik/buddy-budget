import type { InvestmentTransactionType } from "@/lib/db/schema/investments";
import type { CsvTable } from "./csv";
import { detectDateOrder, detectDecimalSeparator, type DateOrder, type DecimalSeparator } from "./values";

/** Campi che una colonna del file può alimentare. */
export const IMPORT_FIELDS = [
  "date",
  "type",
  "symbol",
  "isin",
  "name",
  "quantity",
  "price",
  "total",
  "fees",
  "taxes",
  "currency",
  "note",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

/** Etichette dei campi nella UI di mappatura. */
export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  date: "Data operazione",
  type: "Tipo operazione",
  symbol: "Simbolo / ticker",
  isin: "ISIN",
  name: "Nome strumento",
  quantity: "Quantità",
  price: "Prezzo unitario",
  total: "Controvalore / importo",
  fees: "Commissioni",
  taxes: "Imposte",
  currency: "Valuta",
  note: "Note",
};

/** Valore di una cella "tipo" tradotto in un tipo di operazione, oppure riga da ignorare. */
export type TypeValueTarget = InvestmentTransactionType | "ignora";

/**
 * Come leggere un file: quale colonna (indice) alimenta ciascun campo, il formato di date e numeri, e come
 * tradurre i valori della colonna "tipo". È tutto ciò che distingue un formato da un altro.
 */
export interface ImportMapping {
  columns: Partial<Record<ImportField, number>>;
  dateOrder: DateOrder;
  decimal: DecimalSeparator;
  /** Chiave: valore della cella in minuscolo. */
  typeValues: Record<string, TypeValueTarget>;
  /** Tipo usato quando il file non ha la colonna tipo o la cella è vuota. */
  defaultType: InvestmentTransactionType;
  /** Il simbolo è un ticker Yahoo (`SWDA.MI`, `BTC-EUR`): si cerca così com'è invece che per nome. */
  symbolIsYahoo: boolean;
}

/** Normalizza un'intestazione: minuscole, senza accenti, spazi e simboli (`Quantità (n.)` → `quantitan`). */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Intestazioni riconosciute per ogni campo, in ordine di preferenza (italiano e inglese). */
const HEADER_SYNONYMS: Record<ImportField, string[]> = {
  date: ["tradedate", "dataoperazione", "dataesecuzione", "dataeseguito", "operationdate", "transactiondate", "data", "date", "datetime"],
  type: ["transactiontype", "tipooperazione", "tipo", "operazione", "segno", "side", "action", "type", "causale"],
  symbol: ["symbol", "ticker", "simbolo", "codicetitolo", "codice"],
  isin: ["isin", "codiceisin"],
  name: ["name", "nome", "titolo", "descrizione", "strumento", "instrument", "security", "asset", "prodotto"],
  quantity: ["quantity", "quantita", "qty", "quote", "shares", "units", "nominale"],
  price: ["purchaseprice", "prezzoeseguito", "prezzounitario", "executionprice", "unitprice", "prezzo", "price"],
  total: ["controvalore", "totale", "total", "importo", "amount", "ammontare", "value"],
  fees: ["commission", "commissioni", "commissione", "fees", "fee", "spese", "costi"],
  taxes: ["taxes", "imposte", "tasse", "tax"],
  currency: ["currency", "valuta", "divisa"],
  note: ["comment", "note", "nota", "notes"],
};

/** Valori della colonna tipo riconosciuti da soli (in minuscolo). */
const TYPE_SYNONYMS: Record<string, TypeValueTarget> = {
  buy: "acquisto",
  acquisto: "acquisto",
  acq: "acquisto",
  a: "acquisto",
  b: "acquisto",
  purchase: "acquisto",
  compra: "acquisto",
  sottoscrizione: "acquisto",
  sell: "vendita",
  vendita: "vendita",
  ven: "vendita",
  v: "vendita",
  s: "vendita",
  sale: "vendita",
  dividend: "dividendo",
  dividendo: "dividendo",
  div: "dividendo",
  coupon: "cedola",
  cedola: "cedola",
  rimborso: "rimborso",
  redemption: "rimborso",
  maturity: "rimborso",
};

/** Traduzione proposta per un valore della colonna tipo; quelli sconosciuti si ignorano finché l'utente non sceglie. */
export function suggestTypeValue(value: string): TypeValueTarget {
  return TYPE_SYNONYMS[value.trim().toLowerCase()] ?? "ignora";
}

/**
 * Associa le colonne ai campi per sinonimo: prima le corrispondenze esatte in ordine di preferenza, poi le
 * intestazioni che iniziano con un sinonimo lungo (`Prezzo eseguito EUR`). Ogni colonna alimenta un solo campo.
 */
export function suggestColumns(headers: string[]): Partial<Record<ImportField, number>> {
  const normalized = headers.map(normalizeHeader);
  const used = new Set<number>();
  const columns: Partial<Record<ImportField, number>> = {};
  for (const pass of ["exact", "prefix"] as const) {
    for (const field of IMPORT_FIELDS) {
      if (columns[field] !== undefined) continue;
      for (const synonym of HEADER_SYNONYMS[field]) {
        const index = normalized.findIndex(
          (h, i) => !used.has(i) && (pass === "exact" ? h === synonym : synonym.length >= 5 && h.startsWith(synonym))
        );
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

/** Valori distinti (non vuoti) di una colonna, nell'ordine in cui compaiono. */
export function distinctValues(table: CsvTable, column: number | undefined): string[] {
  if (column === undefined) return [];
  return [...new Set(table.rows.map((r) => (r[column] ?? "").trim()).filter((v) => v !== ""))];
}

function columnValues(table: CsvTable, column: number | undefined): string[] {
  return column === undefined ? [] : table.rows.map((r) => r[column] ?? "").filter((v) => v.trim() !== "");
}

/** Completa una mappatura di colonne con formati di data e numeri dedotti dai valori e tipi tradotti per sinonimo. */
export function completeMapping(
  table: CsvTable,
  columns: Partial<Record<ImportField, number>>,
  overrides: Partial<Omit<ImportMapping, "columns">> = {}
): ImportMapping {
  const numeric = (["quantity", "price", "total", "fees", "taxes"] as const).flatMap((f) => columnValues(table, columns[f]));
  const typeValues: Record<string, TypeValueTarget> = {};
  for (const value of distinctValues(table, columns.type)) typeValues[value.toLowerCase()] = suggestTypeValue(value);
  return {
    columns,
    dateOrder: detectDateOrder(columnValues(table, columns.date)),
    // Senza indizi dai valori: i CSV col punto e virgola (Excel europeo) hanno la virgola decimale.
    decimal: detectDecimalSeparator(numeric, table.delimiter === ";" ? "," : "."),
    typeValues: { ...typeValues, ...overrides.typeValues },
    defaultType: overrides.defaultType ?? "acquisto",
    symbolIsYahoo: overrides.symbolIsYahoo ?? false,
    ...(overrides.dateOrder ? { dateOrder: overrides.dateOrder } : {}),
    ...(overrides.decimal ? { decimal: overrides.decimal } : {}),
  };
}

/** Campi mancanti perché la mappatura sia utilizzabile, come messaggi per l'utente. */
export function missingFields(mapping: ImportMapping): string[] {
  const c = mapping.columns;
  const missing: string[] = [];
  if (c.date === undefined) missing.push("la data");
  if (c.symbol === undefined && c.isin === undefined && c.name === undefined) missing.push("lo strumento (simbolo, ISIN o nome)");
  if (c.quantity === undefined) missing.push("la quantità");
  if (c.price === undefined && c.total === undefined) missing.push("il prezzo o il controvalore");
  return missing;
}
