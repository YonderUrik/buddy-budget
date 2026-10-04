import { isValidIsin, INVESTMENT_NOTE_MAX_LENGTH } from "@/lib/validation/investments";
import { IMPORT_MAX_IDENTITIES, IMPORT_MAX_OPERATIONS } from "@/lib/validation/investments-import";
import { parseCsvRecords } from "./csv";
import { type ImportIdentity, type ImportOperation } from "./normalize";
import { parseDate, parseNumber } from "./values";
import { readBrokerStatement, type BrokerStatement } from "./broker-statement";

export const IBKR_MAX_FILE_BYTES = 5 * 1024 * 1024;

/** All records, including headers, totals, unknown sections and empty cells, in source order. */
export interface ActivityRecord {
  line: number;
  section: string;
  kind: string;
  headers: string[];
  values: string[];
}
export interface ActivityOperation extends ImportOperation {
  key: string;
  line: number;
  /** Prices, income, fees and taxes are all in this currency; import converts costs to user currency. */
  sourceCurrency: string;
}
export interface ActivityIssue {
  line: number;
  section: string;
  severity: "error" | "warning";
  message: string;
}
export interface ActivityStatement {
  preset: "interactive-brokers";
  statement?: BrokerStatement | null;
  records: ActivityRecord[];
  identities: ImportIdentity[];
  operations: ActivityOperation[];
  issues: ActivityIssue[];
}

const value = (r: ActivityRecord, name: string) => r.values[r.headers.indexOf(name)]?.trim() ?? "";
const number = (r: ActivityRecord, name: string) => {
  const raw = value(r, name);
  // IBKR uses decimal points and optional groups of three thousands digits.
  if (!/^[+-]?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw)) return null;
  return parseNumber(raw, ".");
};
const dateOf = (r: ActivityRecord) => parseDate((value(r, "Date/Time") || value(r, "Date")).split(",")[0], "ymd");
const symbolOf = (r: ActivityRecord) => value(r, "Symbol") || /^([^()]+)\(/.exec(value(r, "Description"))?.[1].trim() || "";
const matchKey = (r: ActivityRecord) => JSON.stringify([symbolOf(r), value(r, "Currency"), dateOf(r)]);
const isTotal = (r: ActivityRecord) => /^(Total|SubTotal)(\b|$)/.test(r.kind) || /^(Total|SubTotal)(\b|$)/.test(r.values[0]?.trim() ?? "");

/** English IBKR Activity Statement CSV. Pure parsing: no writes, network calls or private fixture data. */
export function parseInteractiveBrokersActivity(text: string, todayKey: string): ActivityStatement {
  if (new TextEncoder().encode(text).length > IBKR_MAX_FILE_BYTES) throw new Error("File troppo grande (massimo 5 MB)");
  const headers = new Map<string, string[]>();
  const records: ActivityRecord[] = parseCsvRecords(text.replace(/^\uFEFF/, ""), ",", true)
    .filter(({ cells }) => cells.some((c) => c.trim() !== ""))
    .map(({ line, cells }) => {
      const [section = "", kind = "", ...values] = cells;
      if (kind === "Header") headers.set(section, values);
      return { line, section, kind, headers: headers.get(section) ?? [], values };
    });
  const metadata = (field: string) => {
    const row = records.find((r) => r.section === "Statement" && r.kind === "Data" && value(r, "Field Name") === field);
    return row ? value(row, "Field Value") : "";
  };
  if (metadata("Title") !== "Activity Statement" ||
      !records.some((r) => r.section === "Statement" && value(r, "Field Name") === "BrokerName" && /Interactive Brokers/i.test(value(r, "Field Value")))) {
    throw new Error("Il file non è un Activity Statement CSV di Interactive Brokers in inglese");
  }
  const data = records.filter((r) => r.kind === "Data" && !isTotal(r));
  const issues: ActivityIssue[] = [];
  const issue = (r: ActivityRecord, severity: ActivityIssue["severity"], message: string) => issues.push({ line: r.line, section: r.section, severity, message });
  const instruments = data.filter((r) => r.section === "Financial Instrument Information" && value(r, "Asset Category") === "Stocks");
  const renamed = new Map<string, string>();
  for (const r of data.filter((r) => r.section === "Corporate Actions")) {
    const description = value(r, "Description");
    const change = /CUSIP\/ISIN Change to \(([A-Z0-9]{12})\)/.exec(description);
    const alias = /\(([^,()]+),[^()]*,[^()]+\)\s*$/.exec(description)?.[1].trim();
    if (change && isValidIsin(change[1])) {
      renamed.set(symbolOf(r), change[1]);
      if (alias) renamed.set(alias, change[1]);
    }
  }
  const operations: ActivityOperation[] = [];
  const identities = new Map<string, ImportIdentity>();
  const dividendRows = data.filter((r) => r.section === "Dividends");
  const usedTaxes = new Set<number>();

  for (const r of data) {
    if (r.section !== "Trades" && r.section !== "Dividends") continue;
    if (r.headers.length !== r.values.length) {
      issue(r, "error", "Numero di colonne diverso dall'intestazione della sezione");
      continue;
    }
    if (r.section === "Trades" && (value(r, "Asset Category") !== "Stocks" || value(r, "DataDiscriminator") !== "Order")) {
      if (value(r, "Asset Category") !== "Forex" || !data.some((row) => row.section === "Cash Report")) issue(r, "warning", "Operazione non importata: sono supportati solo ordini su azioni ed ETF");
      continue;
    }
    const date = dateOf(r);
    const symbol = symbolOf(r);
    const currency = value(r, "Currency");
    if (!date || date > todayKey || !symbol || !/^[A-Z]{3}$/.test(currency)) {
      issue(r, "error", "Data, simbolo o valuta mancanti o non validi");
      continue;
    }
    const matches = instruments.filter((i) => value(i, "Symbol").split(",").map((s) => s.trim()).includes(symbol));
    const changedIsin = renamed.get(symbol);
    const instrument = changedIsin ? instruments.find((i) => value(i, "Security ID") === changedIsin) : matches.length === 1 ? matches[0] : undefined;
    const rawIsin = changedIsin ?? (instrument ? value(instrument, "Security ID") : /\(([^)]+)\)/.exec(value(r, "Description"))?.[1] ?? "");
    const isin = isValidIsin(rawIsin) ? rawIsin : null;
    // Currency is part of the identity: dual listings must not share prices in different currencies.
    const key = `${isin ? `isin:${isin}` : `symbol:${symbol}`}:${currency}`;
    const identity: ImportIdentity = { key, symbol: changedIsin && instrument ? value(instrument, "Symbol").split(",")[0].trim() : symbol, isin, name: instrument ? value(instrument, "Description") : null, currency, symbolIsYahoo: false };
    if (instrument && value(instrument, "Type") === "ETF") identity.type = "etf";
    let operation: ImportOperation;
    if (r.section === "Trades") {
      const quantity = number(r, "Quantity");
      const price = number(r, "T. Price");
      const commission = number(r, "Comm/Fee");
      if (quantity === null || quantity === 0 || price === null || price <= 0 || commission === null || commission > 0 || /(^|;)Ca(;|$)/.test(value(r, "Code"))) {
        issue(r, "error", "Quantità, prezzo o commissione non validi; storni e rimborsi richiedono verifica");
        continue;
      }
      operation = { type: quantity < 0 ? "vendita" : "acquisto", date, quantity: Math.abs(quantity), price, grossAmount: null, fees: -commission, taxes: 0, note: null };
    } else {
      const grossAmount = number(r, "Amount");
      if (grossAmount === null || grossAmount <= 0) {
        issue(r, "error", "Dividendo nullo o negativo: rettifica da verificare manualmente");
        continue;
      }
      const taxRows = data.filter((t) => t.section === "Withholding Tax" && matchKey(t) === matchKey(r));
      let taxes = 0;
      if (taxRows.length > 0 && dividendRows.filter((d) => matchKey(d) === matchKey(r)).length !== 1) {
        issue(r, "error", "Più dividendi dello stesso strumento e giorno: abbinamento imposte ambiguo");
        continue;
      }
      const amounts = taxRows.map((t) => number(t, "Amount"));
      if (taxRows.some((t) => t.headers.length !== t.values.length) || amounts.some((n) => n === null)) {
        issue(r, "error", "Importo ritenuta non valido");
        continue;
      }
      // Signed sum handles tax reversals/refunds without charging the same withholding twice.
      taxes = -amounts.reduce<number>((sum, n) => sum + n!, 0);
      if (taxes < -0.00000001) {
        issue(r, "error", "Rimborso fiscale netto: verifica manuale necessaria");
        continue;
      }
      for (const t of taxRows) usedTaxes.add(t.line);
      operation = { type: "dividendo", date, quantity: 0, price: 0, grossAmount, fees: 0, taxes: Math.max(0, taxes), note: value(r, "Description").slice(0, INVESTMENT_NOTE_MAX_LENGTH) };
    }
    identities.set(key, identity);
    operations.push({ ...operation, key, line: r.line, sourceCurrency: currency });
  }
  // A spinoff creates shares without a cash purchase. A fully disposed grant can recover
  // its reported basis from the sale rows; do not fabricate a zero basis for an unknown grant.
  const handledActions = new Set<number>();
  for (const r of data.filter((r) => r.section === "Corporate Actions")) {
    const description = value(r, "Description");
    if (description.includes("CUSIP/ISIN Change")) {
      const symbol = /\(([^,()]+),[^()]*,[^()]+\)\s*$/.exec(description)?.[1].trim();
      if (symbol && instruments.some((i) => value(i, "Symbol").split(",").map((s) => s.trim()).includes(symbol))) handledActions.add(r.line);
      continue;
    }
    const child = /Spinoff\s+[^()]+\(([^,]+),\s*(.+),\s*([A-Z0-9]{12})\)/.exec(description);
    if (!child) continue;
    const [, symbol, name, isin] = child;
    const quantity = number(r, "Quantity"); const date = dateOf(r); const currency = value(r, "Currency");
    const sales = data.filter((t) => t.section === "Trades" && value(t, "DataDiscriminator") === "Order" && value(t, "Symbol") === symbol && value(t, "Currency") === currency && (dateOf(t) ?? "") >= (date ?? ""));
    const sold = sales.reduce((sum, t) => sum - (number(t, "Quantity") ?? 0), 0);
    const basis = sales.reduce((sum, t) => sum - (number(t, "Basis") ?? 0), 0);
    if (!quantity || !date || date > todayKey || !isValidIsin(isin) || !/^[A-Z]{3}$/.test(currency) || sales.some((t) => (number(t, "Quantity") ?? 0) >= 0 || number(t, "Basis") === null) || Math.abs(sold - quantity) > 1e-8 || basis <= 0) {
      issue(r, "error", "Spinoff: base di costo non ricostruibile. Serve il dettaglio dell'assegnazione/lotti del broker");
      continue;
    }
    const parentSymbol = symbolOf(r);
    let parent = [...identities.values()].find((i) => i.symbol === parentSymbol && i.currency === currency);
    if (!parent) {
      const metadata = instruments.find((i) => value(i, "Symbol").split(",").map((s) => s.trim()).includes(parentSymbol));
      const parentIsin = metadata ? value(metadata, "Security ID") : "";
      if (metadata && isValidIsin(parentIsin)) {
        parent = { key: `isin:${parentIsin}:${currency}`, symbol: parentSymbol, isin: parentIsin, name: value(metadata, "Description"), currency, symbolIsYahoo: false };
        identities.set(parent.key, parent);
      }
    }
    if (!parent) { issue(r, "error", "Strumento origine dello spinoff non trovato"); continue; }
    const key = `isin:${isin}:${currency}`;
    identities.set(key, { key, isin, symbol, name, currency, symbolIsYahoo: false });
    operations.push({ key, line: r.line, sourceCurrency: currency, type: "rettifica", date, quantity, price: 0, grossAmount: basis, fees: 0, taxes: 0,
      note: "Spinoff (nessun esborso): costo complessivo ricostruito dai lotti interamente ceduti nel rendiconto. Per il risultato del broker consultare Rendiconti." });
    // Separate synthetic row ID for the parent's non-cash basis transfer.
    operations.push({ key: parent.key, line: records.at(-1)!.line + r.line, sourceCurrency: currency, type: "rettifica", date, quantity: 0, price: 0, grossAmount: -basis, fees: 0, taxes: 0, note: `Spinoff: trasferimento base di costo a ${symbol} (riga ${r.line})` });
    handledActions.add(r.line);
  }
  const statement = readBrokerStatement(records);
  if (!statement) for (const r of data) {
    if (["Transaction Fees", "Fees", "Interest", "Deposits & Withdrawals"].includes(r.section) || (r.section === "Withholding Tax" && !usedTaxes.has(r.line))) issue(r, "warning", "Dato conservato: import completo richiede Cash Report e Net Asset Value");
  }
  const reviewSections = new Set(["Corporate Actions", "Transfers"]);
  for (const r of data) {
    if (reviewSections.has(r.section) && !handledActions.has(r.line)) {
      issue(r, "error", "Operazione sul capitale non supportata: import bloccato per evitare posizioni errate");
    }
  }
  if (operations.length > IMPORT_MAX_OPERATIONS || identities.size > IMPORT_MAX_IDENTITIES) throw new Error("Il file supera i limiti di operazioni o strumenti per import");
  return { preset: "interactive-brokers", statement, records, identities: [...identities.values()], operations, issues };
}
