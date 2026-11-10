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
  type?: import("@/lib/db/schema/investments").InstrumentType;
  /** OpenFIGI exchange code of the listing the broker reports (IBKR «Listing Exch»): matching tries it first. */
  exchange?: string | null;
  /**
   * The broker reports a corporate action on it (ISIN change, spinoff): market histories are adjusted for it and do
   * not match the trade prices, so the security keeps the broker's prices instead of a linked quotation.
   */
  corporateAction?: boolean;
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
  /** Se presente, tutti gli importi (anche costi) sono in questa valuta (es. file di un broker estero). */
  sourceCurrency?: string;
  /** Explicit currency of costs when different from the security (DEGIRO fees are EUR). */
  costCurrency?: string;
  /** Broker execution FX, when the export supplies a complete matched conversion. */
  brokerFxToEur?: number;
}

/** Esito della lettura di una riga del file. `line` è il numero di riga nel file (1 = intestazioni). */
export type ImportRow =
  | { line: number; status: "ok"; identity: ImportIdentity; operation: ImportOperation; warnings: string[] }
  | { line: number; status: "skipped" | "error"; message: string };

const POSITION_TYPES: ReadonlySet<InvestmentTransactionType> = new Set(["acquisto", "vendita", "rimborso"]);

/** A currency cell in pence sterling: «GBp» or «GBX» (not «GBP», the pound). */
export function isPence(value: string): boolean {
  return value === "GBp" || value.toUpperCase() === "GBX";
}

/** Chiave dello strumento: ISIN valido, poi simbolo, poi nome. */
function identityOf(cell: (f: ImportField) => string, symbolIsYahoo: boolean): ImportIdentity | null {
  const rawIsin = cell("isin").toUpperCase();
  const isin = isValidIsin(rawIsin) ? rawIsin : null;
  const symbol = cell("symbol").toUpperCase() || null;
  const name = cell("name") || null;
  const raw = cell("currency");
  // Pence (Yahoo writes «GBp», some brokers «GBX») is read as pounds, with the amounts divided by 100 in `normalizeRows`.
  const currency = isPence(raw) ? "GBP" : /^[A-Za-z]{3}$/.test(raw) ? raw.toUpperCase() : null;
  const key = isin ? `isin:${isin}` : symbol ? `symbol:${symbol}` : name ? `name:${name.toLowerCase()}` : null;
  return key ? { key, symbol, isin, name, currency, symbolIsYahoo } : null;
}

/** How far a bond's total may sit from nominal × price / 100: accrued interest and costs move it a little. */
const BOND_TOTAL_TOLERANCE = 0.05;

/**
 * A row priced per hundred of nominal: the total is quantity × price / 100, not quantity × price (a BTP bought at
 * 98.5 for 10,000 nominal costs about 9,850). Read from the numbers, so no file needs to say «obbligazione»: without
 * it a bond became a share worth a hundred times its value.
 */
export function quotedPerHundred(quantity: number, price: number, total: number | null): boolean {
  if (total === null || !(quantity > 0) || !(price > 0) || !(total > 0)) return false;
  const perHundred = (quantity * price) / 100;
  return Math.abs(total - perHundred) <= perHundred * BOND_TOTAL_TOLERANCE && Math.abs(total - quantity * price) > quantity * price * BOND_TOTAL_TOLERANCE;
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
    // Prices and totals quoted in pence become pounds (fees are in the user's currency and stay as they are).
    const scale = isPence(cell("currency")) ? 0.01 : 1;
    const number = (field: ImportField) => {
      if (cell(field) === "") return null;
      const value = parseNumber(cell(field), mapping.decimal);
      return value !== null && (field === "price" || field === "total") ? value * scale : value;
    };

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

    if (type === "split") {
      if (!(quantity > 0)) return { line, status: "error", message: "Rapporto dello split mancante (va nella colonna delle quote)" };
      return { line, status: "ok", identity, operation: { type, date, quantity, price: 0, grossAmount: null, fees: 0, taxes: 0, note }, warnings };
    }

    if (POSITION_TYPES.has(type)) {
      if (!(quantity > 0)) return { line, status: "error", message: "Quantità mancante o zero" };
      const price = number("price") !== null ? Math.abs(number("price")!) : total !== null ? total / quantity : null;
      if (price === null) return { line, status: "error", message: "Prezzo mancante" };
      if (price === 0 && type !== "acquisto") return { line, status: "error", message: "Prezzo zero su una vendita" };
      if (price === 0) warnings.push("Prezzo zero: quote ricevute gratis (es. staking)");
      const bond = quotedPerHundred(quantity, price, total);
      return { line, status: "ok", identity: bond ? { ...identity, type: "obbligazione" } : identity, operation: { type, date, quantity, price, grossAmount: null, fees, taxes, note }, warnings };
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
      current.type ??= row.identity.type;
    } else byKey.set(row.identity.key, { ...row.identity, count: 1 });
  }
  return [...byKey.values()];
}
