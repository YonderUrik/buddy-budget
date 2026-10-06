import { parseCsvRecords } from "./csv";
import { parseDate } from "./values";
import { isValidIsin } from "@/lib/validation/investments";
import { IMPORT_MAX_IDENTITIES, IMPORT_MAX_OPERATIONS } from "@/lib/validation/investments-import";
import { IBKR_MAX_FILE_BYTES, type ActivityStatement } from "./interactive-brokers";
import type { ImportIdentity } from "./normalize";

const REQUIRED = ["datetime", "date", "account_type", "category", "type", "asset_class", "name", "symbol", "shares", "price", "amount", "fee", "tax", "currency", "description", "transaction_id"];

export interface TradeRepublicCashMovement {
  line: number; date: string; currency: string; amount: number; externalId: string;
  description: string; rawDescription: string; merchantCategoryCode: string | null;
}

/** Recognize Transaction export.csv by its columns, independently of the filename. */
export function looksLikeTradeRepublic(text: string): boolean {
  try {
    const headers = parseCsvRecords(text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0], ",", true)[0]?.cells ?? [];
    return REQUIRED.every((h) => headers.includes(h));
  } catch { return false; }
}

/** Read the complete export: securities, card payments, transfers, interest, fees and taxes. */
export function parseTradeRepublic(text: string, today: string): ActivityStatement {
  if (new TextEncoder().encode(text).length > IBKR_MAX_FILE_BYTES) throw new Error("File troppo grande (massimo 5 MB)");
  if (!looksLikeTradeRepublic(text)) throw new Error("Serve il CSV Transaction export di Trade Republic");
  const csv = parseCsvRecords(text.replace(/^\uFEFF/, ""), ",", true).filter((r) => r.cells.some(Boolean));
  const headers = csv[0].cells;
  if (new Set(headers).size !== headers.length) throw new Error("Intestazioni duplicate");
  const rows = csv.slice(1);
  if (!rows.length || rows.length > IMPORT_MAX_OPERATIONS) throw new Error("Export vuoto o oltre il limite di 5000 movimenti");
  const identities = new Map<string, ImportIdentity>();
  const operations: ActivityStatement["operations"] = [];
  const ledger: NonNullable<ActivityStatement["statement"]>["ledger"] = [];
  const cashMovements: TradeRepublicCashMovement[] = [];
  const seen = new Set<string>();
  const dates: string[] = [];
  for (const r of rows) {
    const fail = (message: string): never => { throw new Error(`Riga ${r.line}: ${message}`); };
    if (r.cells.length !== headers.length) fail("numero colonne non valido");
    const v = (name: string) => r.cells[headers.indexOf(name)]?.trim() ?? "";
    const n = (name: string, optional = false): number => {
      const raw = v(name);
      if (!raw && optional) return 0;
      if (!/^[+-]?\d+(?:\.\d+)?$/.test(raw) || !Number.isFinite(Number(raw))) return fail(`${name} non valido`);
      return Number(raw);
    };
    const date = parseDate(v("date"), "ymd");
    if (!date || date > today || !/^\d{4}-\d{2}-\d{2}T/.test(v("datetime")) || !Number.isFinite(Date.parse(v("datetime"))) || Math.abs(Date.parse(v("datetime").slice(0, 10)) - Date.parse(date)) > 86400000) fail("data non valida o futura");
    dates.push(date!);
    if (v("account_type") !== "DEFAULT") fail("tipo di conto non supportato: esporta il conto principale separatamente");
    const id = v("transaction_id");
    if (!id || seen.has(id)) fail("transaction_id mancante o duplicato");
    seen.add(id);
    const currency = v("currency");
    if (!/^[A-Z]{3}$/.test(currency)) fail("valuta non valida");
    const amount = n("amount"), fee = n("fee", true), tax = n("tax", true);
    const type = v("type");
    const description = v("name") || v("counterparty_name") || v("payment_reference") || v("description") || type;
    // amount is the gross cash leg; fee and tax are separate signed cash components.
    const net = amount + fee + tax;
    ledger.push({ line: r.line, date: date!, currency, amount: net, kind: type, description });
    if (v("category") === "TRADING") {
      if (!["BUY", "SELL"].includes(type)) fail(`operazione investimento non supportata: ${type}`);
      const asset = v("asset_class");
      if (!["STOCK", "FUND", "CRYPTO"].includes(asset)) fail(`classe di investimento non supportata: ${asset}`);
      const symbol = v("symbol"), isin = asset === "CRYPTO" ? null : symbol;
      if (!symbol || (isin && !isValidIsin(isin))) fail("simbolo o ISIN non valido");
      const quantity = Math.abs(n("shares")), price = n("price");
      if (!quantity || price <= 0 || fee > 0 || tax > 0 || (type === "BUY" ? n("shares") <= 0 || amount > 0 : n("shares") >= 0 || amount < 0) || Math.abs(quantity * price - Math.abs(amount)) > 0.011) fail("quantità, controvalore o costi incoerenti");
      const key = `${isin ? "isin" : "crypto"}:${symbol}:${currency}`;
      identities.set(key, { key, symbol, isin, currency, name: v("name"), symbolIsYahoo: false, type: asset === "CRYPTO" ? "crypto" : asset === "FUND" ? "etf" : "azione" });
      operations.push({ key, line: r.line, date: date!, type: type === "BUY" ? "acquisto" : "vendita", quantity, price, grossAmount: null, fees: -fee, taxes: -tax, sourceCurrency: currency, note: null });
    } else if (v("category") === "CASH") {
      if (!type) fail("tipo movimento mancante");
      cashMovements.push({ line: r.line, date: date!, currency, amount: net, externalId: `trade-republic:${id}`, description, rawDescription: v("description") || v("payment_reference") || description, merchantCategoryCode: /^\d{4}$/.test(v("mcc_code")) ? v("mcc_code") : null });
    } else fail(`categoria non supportata: ${v("category")}`);
  }
  if (identities.size > IMPORT_MAX_IDENTITIES) throw new Error("Troppi strumenti nel file");
  dates.sort();
  const cash = [...new Set(ledger.map((r) => r.currency))].map((currency) => {
    const closing = ledger.filter((r) => r.currency === currency).reduce((sum, r) => sum + r.amount, 0);
    return { currency, opening: 0, closing, calculated: closing, difference: 0 };
  });
  return { preset: "trade-republic", identities: [...identities.values()], operations, cashMovements, issues: [], records: csv.map((r, i) => ({ line: r.line, section: "Trade Republic", kind: i ? "Data" : "Header", headers, values: r.cells })), statement: {
    provider: "trade-republic", account: "Trade Republic", currency: "EUR", from: dates[0], to: dates.at(-1)!, valuationAvailable: false, positionsReported: false,
    nav: [], cash, ledger, positions: [], performance: [], issues: [],
  } };
}
