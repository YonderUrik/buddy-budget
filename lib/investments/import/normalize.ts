import type { InvestmentTransactionType } from "@/lib/db/schema/investments";
import { INVESTMENT_NOTE_MAX_LENGTH, isValidIsin } from "@/lib/validation/investments";
import type { CsvTable } from "./csv";
import type { ImportField, ImportMapping } from "./mapping";
import { parseDate, parseNumber } from "./values";

/** Come identificare lo strumento di una riga; `key` raggruppa le righe dello stesso strumento. */
export interface ImportIdentity {
  key: string;
  symbol: string | null;
  isin: string | null;
  name: string | null;
  currency: string | null;
  symbolIsYahoo: boolean;
}

/** Operazione letta da una riga, nella forma dell'API (importi nella valuta dello strumento, costi in quella utente). */
export interface ImportOperation {
  type: InvestmentTransactionType;
  date: string;
  quantity: number;
  price: number;
  grossAmount: number | null;
  fees: number;
  taxes: number;
  note: string | null;
}

/** Esito della lettura di una riga del file. `line` è il numero di riga nel file (1 = intestazioni). */
export type ImportRow =
  | { line: number; status: "ok"; identity: ImportIdentity; operation: ImportOperation; warnings: string[] }
  | { line: number; status: "skipped" | "error"; message: string };

const POSITION_TYPES: ReadonlySet<InvestmentTransactionType> = new Set(["acquisto", "vendita", "rimborso"]);

/** Chiave dello strumento: ISIN valido, poi simbolo, poi nome. */
function identityOf(cell: (f: ImportField) => string, symbolIsYahoo: boolean): ImportIdentity | null {
  const rawIsin = cell("isin").toUpperCase();
  const isin = isValidIsin(rawIsin) ? rawIsin : null;
  const symbol = cell("symbol").toUpperCase() || null;
  const name = cell("name") || null;
  const currency = /^[A-Za-z]{3}$/.test(cell("currency")) ? cell("currency").toUpperCase() : null;
  const key = isin ? `isin:${isin}` : symbol ? `symbol:${symbol}` : name ? `name:${name.toLowerCase()}` : null;
  return key ? { key, symbol, isin, name, currency, symbolIsYahoo } : null;
}

/**
 * Legge le righe del file con la mappatura. Una quantità negativa su un acquisto è una vendita (alcuni broker
 * esportano così). Un acquisto a prezzo zero si accetta con un avviso: sono quote ricevute gratis (staking, bonus),
 * come le registra Yahoo. Per dividendi e cedole l'importo lordo è il controvalore, o quantità × prezzo.
 */
export function normalizeRows(table: CsvTable, mapping: ImportMapping, todayKey: string): ImportRow[] {
  return table.rows.map((cells, index): ImportRow => {
    const line = index + 2;
    const cell = (field: ImportField) => {
      const column = mapping.columns[field];
      return column === undefined ? "" : (cells[column] ?? "").trim();
    };
    const number = (field: ImportField) => (cell(field) === "" ? null : parseNumber(cell(field), mapping.decimal));

    const rawType = cell("type");
    const target = rawType === "" ? mapping.defaultType : (mapping.typeValues[rawType.toLowerCase()] ?? "ignora");
    if (target === "ignora") return { line, status: "skipped", message: `Tipo "${rawType}" ignorato` };

    const date = parseDate(cell("date"), mapping.dateOrder);
    if (!date) return { line, status: "error", message: cell("date") ? `Data "${cell("date")}" non valida` : "Data mancante" };
    if (date > todayKey) return { line, status: "error", message: "Data nel futuro" };

    const identity = identityOf(cell, mapping.symbolIsYahoo);
    if (!identity) return { line, status: "error", message: "Manca lo strumento (simbolo, ISIN o nome)" };

    for (const field of ["quantity", "price", "total", "fees", "taxes"] as const) {
      if (cell(field) !== "" && number(field) === null) return { line, status: "error", message: `Numero "${cell(field)}" non valido` };
    }
    const warnings: string[] = [];
    if (cell("isin") && !identity.isin) warnings.push(`ISIN "${cell("isin")}" non valido, ignorato`);

    let type = target;
    const signedQuantity = number("quantity") ?? 0;
    if (type === "acquisto" && signedQuantity < 0) type = "vendita";
    const quantity = Math.abs(signedQuantity);
    const total = number("total") === null ? null : Math.abs(number("total")!);
    const fees = Math.abs(number("fees") ?? 0);
    const taxes = Math.abs(number("taxes") ?? 0);
    const note = cell("note").slice(0, INVESTMENT_NOTE_MAX_LENGTH) || null;

    if (POSITION_TYPES.has(type)) {
      if (!(quantity > 0)) return { line, status: "error", message: "Quantità mancante o zero" };
      const price = number("price") !== null ? Math.abs(number("price")!) : total !== null ? total / quantity : null;
      if (price === null) return { line, status: "error", message: "Prezzo mancante" };
      if (price === 0 && type !== "acquisto") return { line, status: "error", message: "Prezzo zero su una vendita" };
      if (price === 0) warnings.push("Prezzo zero: quote ricevute gratis (es. staking)");
      return { line, status: "ok", identity, operation: { type, date, quantity, price, grossAmount: null, fees, taxes, note }, warnings };
    }

    const price = Math.abs(number("price") ?? 0);
    const gross = total ?? (quantity > 0 && price > 0 ? quantity * price : null);
    if (!gross) return { line, status: "error", message: "Importo del dividendo o della cedola mancante" };
    return { line, status: "ok", identity, operation: { type, date, quantity: 0, price: 0, grossAmount: gross, fees, taxes, note }, warnings };
  });
}

/** Strumenti distinti delle righe valide, con quante operazioni ha ciascuno. */
export function collectIdentities(rows: ImportRow[]): (ImportIdentity & { count: number })[] {
  const byKey = new Map<string, ImportIdentity & { count: number }>();
  for (const row of rows) {
    if (row.status !== "ok") continue;
    const current = byKey.get(row.identity.key);
    if (current) {
      current.count += 1;
      current.name ??= row.identity.name;
      current.symbol ??= row.identity.symbol;
      current.currency ??= row.identity.currency;
    } else byKey.set(row.identity.key, { ...row.identity, count: 1 });
  }
  return [...byKey.values()];
}
