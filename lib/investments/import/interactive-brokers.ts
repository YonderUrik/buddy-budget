import { isValidIsin, INVESTMENT_NOTE_MAX_LENGTH } from "@/lib/validation/investments";
import { IMPORT_MAX_IDENTITIES, IMPORT_MAX_OPERATIONS } from "@/lib/validation/investments-import";
import { parseCsvRecords } from "./csv";
import { type ImportIdentity, type ImportOperation } from "./normalize";
import { parseDate, parseNumber } from "./values";

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
      issue(r, "warning", "Operazione non importata: sono supportati solo ordini su azioni ed ETF");
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
    const instrument = matches.length === 1 ? matches[0] : undefined;
    const rawIsin = instrument ? value(instrument, "Security ID") : /\(([^)]+)\)/.exec(value(r, "Description"))?.[1] ?? "";
    const isin = isValidIsin(rawIsin) ? rawIsin : null;
    // Currency is part of the identity: dual listings must not share prices in different currencies.
    const key = `${isin ? `isin:${isin}` : `symbol:${symbol}`}:${currency}`;
    const identity: ImportIdentity = { key, symbol, isin, name: instrument ? value(instrument, "Description") : null, currency, symbolIsYahoo: false };
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
  const reviewSections = new Set(["Corporate Actions", "Transaction Fees", "Fees", "Interest", "Deposits & Withdrawals", "Transfers"]);
  for (const r of data) {
    if (reviewSections.has(r.section) || (r.section === "Withholding Tax" && !usedTaxes.has(r.line))) {
      issue(r, "warning", "Dato conservato nel rendiconto ma non importato automaticamente: richiede verifica");
    }
  }
  if (operations.length > IMPORT_MAX_OPERATIONS || identities.size > IMPORT_MAX_IDENTITIES) throw new Error("Il file supera i limiti di operazioni o strumenti per import");
  return { preset: "interactive-brokers", records, identities: [...identities.values()], operations, issues };
}
