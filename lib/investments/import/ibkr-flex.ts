import { childNamed, childrenNamed, parseXml, XmlParseError, type XmlElement } from "@/lib/ibkr-flex/xml";
import { readInteractiveBrokersRecords, type ActivityRecord, type ActivityStatement } from "./interactive-brokers";

/**
 * Interactive Brokers Flex Web Service report (Activity Flex Query, XML) read as an Activity Statement.
 *
 * The XML sections are rewritten into the records of the English Activity Statement CSV (same section and column
 * names), then read by `readInteractiveBrokersRecords`: one reader, so trades, dividends with their withholding,
 * corporate actions, cash reconciliation, NAV and open positions follow the rules the CSV import already enforces,
 * and a Flex report and a CSV statement of the same account share its periods (same account key).
 *
 * Values stay the decimal strings IBKR wrote: amounts are summed only by the shared reader, with its tolerances.
 * Identifiers IBKR gives (conid, ISIN, transactionID, tradeID) are kept as extra columns in the stored records.
 */

/** Flex XML is verbose: a year of an active account is several times its CSV. */
export const IBKR_FLEX_MAX_BYTES = 25 * 1024 * 1024;

/** Sections a Flex Query must include; the others are checked by the cash and position reconciliation. */
export const IBKR_FLEX_REQUIRED_SECTIONS = [
  { element: "AccountInformation", label: "Account Information" },
  { element: "CashReport", label: "Cash Report" },
  { element: "EquitySummaryInBase", label: "Net Asset Value (NAV) in Base" },
] as const;
/** Sections the guide asks for; an omitted one with activity makes cash or positions fail to reconcile. */
export const IBKR_FLEX_RECOMMENDED_SECTIONS = ["Open Positions", "Trades", "Cash Transactions", "Corporate Actions", "Transfers", "Financial Instrument Information"] as const;

/** A report that cannot be read as a complete statement; `code` is a closed enum safe for logs and the UI. */
export class IbkrFlexReportError extends Error {
  constructor(public readonly code: "not_flex" | "malformed" | "multiple_accounts" | "missing_sections" | "date_format" | "too_large", message: string, public readonly sections: string[] = []) {
    super(message);
    this.name = "IbkrFlexReportError";
  }
}

/** A Flex report starts with `<FlexQueryResponse`, after an optional XML declaration. */
export function looksLikeIbkrFlex(text: string): boolean {
  return /^﻿?\s*(<\?xml[^>]*\?>\s*)?<FlexQueryResponse[\s>]/.test(text.slice(0, 500));
}

const ASSET_CATEGORIES: Record<string, string> = {
  STK: "Stocks", CASH: "Forex", OPT: "Equity and Index Options", FOP: "Options On Futures", FUT: "Futures", BOND: "Bonds",
  FUND: "Mutual Funds", CRYPTO: "Crypto", WAR: "Warrants", CFD: "CFDs", BILL: "Treasury Bills",
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Cash transaction types (normalised: lowercase letters only) and the Activity Statement section they belong to. */
const CASH_SECTIONS: Record<string, string> = {
  dividends: "Dividends",
  paymentinlieuofdividends: "Dividends",
  withholdingtax: "Withholding Tax",
  withholding871m: "Withholding Tax",
  depositswithdrawals: "Deposits & Withdrawals",
  brokerinterestpaid: "Interest",
  brokerinterestreceived: "Interest",
  bondinterestpaid: "Interest",
  bondinterestreceived: "Interest",
  otherfees: "Fees",
  advisorfees: "Fees",
  commissionadjustments: "Fees",
  priceadjustments: "Fees",
};

/** `20260105`, `2026-01-05` (Flex default and ISO date formats); null for any other configured format. */
function flexDate(raw: string | undefined): string | null {
  const match = /^(\d{4})-?(\d{2})-?(\d{2})(?:$|[;,\sT])/.exec((raw ?? "").trim());
  if (!match) return null;
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  return Number.isFinite(Date.parse(date)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date ? date : null;
}

/** `20260105;101500` → `2026-01-05, 10:15:00`, as the CSV writes it; midnight when the report has the date only. */
function flexDateTime(raw: string | undefined, fallback?: string): string | null {
  const date = flexDate(raw) ?? flexDate(fallback);
  if (!date) return null;
  const time = /[;,\sT](\d{2}):?(\d{2}):?(\d{2})/.exec(raw ?? "");
  return `${date}, ${time ? `${time[1]}:${time[2]}:${time[3]}` : "00:00:00"}`;
}

const longDate = (date: string) => `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}, ${date.slice(0, 4)}`;
const typeKey = (type: string) => type.toLowerCase().replace(/[^a-z0-9]/g, "");
/** Detail rows when the query lists both detail and summary rows, so nothing is counted twice. */
const detailRows = (rows: XmlElement[]) => {
  const detail = rows.filter((e) => !e.attributes.levelOfDetail || /^DETAIL$/i.test(e.attributes.levelOfDetail));
  return detail.length ? detail : rows;
};

/** Builds records section by section, with a Header record whenever the columns change, like the CSV. */
class RecordWriter {
  readonly records: ActivityRecord[] = [];
  private last = new Map<string, string>();
  private line = 0;
  add(section: string, fields: [string, string | undefined][]) {
    const headers = fields.map(([name]) => name);
    const values = fields.map(([, value]) => (value ?? "").trim());
    const signature = JSON.stringify(headers);
    if (this.last.get(section) !== signature) {
      this.records.push({ line: ++this.line, section, kind: "Header", headers, values: headers });
      this.last.set(section, signature);
    }
    this.records.push({ line: ++this.line, section, kind: "Data", headers, values });
  }
}

/** Sum of two decimal strings without binary noise (IBKR amounts have at most 8-9 decimals). */
function addDecimals(a: string | undefined, b: string | undefined): string | undefined {
  if (!b || Number(b) === 0) return a;
  const places = Math.max(...[a ?? "0", b].map((n) => n.split(".")[1]?.length ?? 0));
  const sum = (Number(a ?? 0) + Number(b)).toFixed(places);
  return places ? sum.replace(/0+$/, "").replace(/\.$/, "") : sum;
}

/**
 * Read a Flex report into the Activity Statement shape. Throws `IbkrFlexReportError` for a document that is not a
 * single-account Activity Flex report with the required sections; data problems become statement issues, as for CSV.
 */
export function parseIbkrFlexReport(text: string, todayKey: string): ActivityStatement {
  if (text.length > IBKR_FLEX_MAX_BYTES) throw new IbkrFlexReportError("too_large", "Report Flex troppo grande (massimo 25 MB): riduci il periodo");
  if (!looksLikeIbkrFlex(text)) throw new IbkrFlexReportError("not_flex", "Il file non è un report Flex di Interactive Brokers");
  let root: XmlElement;
  try { root = parseXml(text); } catch (error) {
    if (error instanceof XmlParseError) throw new IbkrFlexReportError("malformed", "Report Flex non leggibile (XML non valido)");
    throw error;
  }
  if (root.name !== "FlexQueryResponse") throw new IbkrFlexReportError("not_flex", "Il file non è un report Flex di Interactive Brokers");
  if (root.attributes.type && root.attributes.type !== "AF") throw new IbkrFlexReportError("not_flex", "Serve una Activity Flex Query, non una Trade Confirmation");
  const statements = childrenNamed(childNamed(root, "FlexStatements") ?? root, "FlexStatement");
  if (statements.length !== 1) throw new IbkrFlexReportError("multiple_accounts", "La Flex Query deve riguardare un solo conto");
  const statement = statements[0];
  const missing = IBKR_FLEX_REQUIRED_SECTIONS.filter((s) => !childNamed(statement, s.element)).map((s) => s.label);
  if (missing.length) throw new IbkrFlexReportError("missing_sections", `Nella Flex Query mancano le sezioni: ${missing.join(", ")}`, missing);
  const from = flexDate(statement.attributes.fromDate);
  const to = flexDate(statement.attributes.toDate);
  if (!from || !to) throw new IbkrFlexReportError("date_format", "Formato data della Flex Query non supportato: scegli yyyyMMdd");

  const section = (name: string) => childNamed(statement, name);
  const items = (name: string, child: string) => { const found = section(name); return found ? childrenNamed(found, child) : []; };
  const info = childNamed(statement, "AccountInformation")!;
  const account = info.attributes.accountId || statement.attributes.accountId || "";
  if (statement.attributes.accountId && info.attributes.accountId && statement.attributes.accountId !== info.attributes.accountId) {
    throw new IbkrFlexReportError("multiple_accounts", "La Flex Query deve riguardare un solo conto");
  }
  const out = new RecordWriter();
  const issues: ActivityStatement["issues"] = [];

  out.add("Statement", [["Field Name", "BrokerName"], ["Field Value", "Interactive Brokers (Flex Web Service)"]]);
  out.add("Statement", [["Field Name", "Title"], ["Field Value", "Activity Statement"]]);
  out.add("Statement", [["Field Name", "Period"], ["Field Value", `${longDate(from)} - ${longDate(to)}`]]);
  out.add("Account Information", [["Field Name", "Account"], ["Field Value", account]]);
  out.add("Account Information", [["Field Name", "Base Currency"], ["Field Value", info.attributes.currency]]);

  // Instruments: SecuritiesInfo when the query has it, else the identifiers each row carries (conid, ISIN, listing).
  const instruments = new Map<string, XmlElement>();
  const rememberInstrument = (e: XmlElement) => {
    const key = e.attributes.conid || `${e.attributes.symbol}:${e.attributes.isin}`;
    if (e.attributes.assetCategory === "STK" && e.attributes.symbol && !instruments.has(key)) instruments.set(key, e);
  };
  for (const e of items("SecuritiesInfo", "SecurityInfo")) rememberInstrument(e);
  const executions = items("Trades", "Trade").filter((e) => !e.attributes.levelOfDetail || /^EXECUTION$/i.test(e.attributes.levelOfDetail));
  const trades = executions.length ? executions : [...items("Trades", "Order"), ...items("Trades", "Trade").filter((e) => /^ORDER$/i.test(e.attributes.levelOfDetail ?? ""))];
  const positions = items("OpenPositions", "OpenPosition").filter((e) => !/^LOT$/i.test(e.attributes.levelOfDetail ?? ""));
  for (const e of [...trades, ...positions, ...items("CashTransactions", "CashTransaction"), ...items("CorporateActions", "CorporateAction")]) rememberInstrument(e);
  for (const e of instruments.values()) {
    out.add("Financial Instrument Information", [["Asset Category", "Stocks"], ["Symbol", e.attributes.symbol], ["Description", e.attributes.description], ["Conid", e.attributes.conid],
      ["Security ID", e.attributes.isin || e.attributes.securityID], ["Listing Exch", e.attributes.listingExchange], ["Multiplier", e.attributes.multiplier], ["Type", e.attributes.subCategory === "ETF" ? "ETF" : "COMMON"]]);
  }

  const taxedTrades = new Set<string>();
  for (const e of trades) {
    const a = e.attributes;
    const category = ASSET_CATEGORIES[a.assetCategory] ?? a.assetCategory;
    const dateTime = flexDateTime(a.dateTime, a.tradeDate);
    if (!dateTime) throw new IbkrFlexReportError("date_format", "Formato data della Flex Query non supportato: scegli yyyyMMdd");
    const cancelled = /\(Ca\.?\)/i.test(a.buySell ?? "");
    const code = [a.notes, cancelled ? "Ca" : ""].filter(Boolean).join(";");
    const commissionCurrency = a.ibCommissionCurrency || a.currency;
    const ids: [string, string | undefined][] = [["Conid", a.conid], ["Transaction ID", a.transactionID], ["Trade ID", a.tradeID]];
    if (category === "Forex") {
      if (Number(a.taxes || 0) !== 0) issues.push({ line: out.records.length + 1, section: "Trades", severity: "error", message: "Imposte su un cambio valuta: non supportate" });
      out.add("Trades", [["DataDiscriminator", "Order"], ["Asset Category", category], ["Currency", a.currency], ["Symbol", a.symbol], ["Date/Time", dateTime], ["Quantity", a.quantity],
        ["T. Price", a.tradePrice], ["Proceeds", a.proceeds], [`Comm in ${commissionCurrency}`, a.ibCommission], ["Code", code], ...ids]);
      continue;
    }
    if (commissionCurrency !== a.currency) issues.push({ line: out.records.length + 1, section: "Trades", severity: "error", message: `Commissione in ${commissionCurrency} su un'operazione in ${a.currency}: non supportata` });
    // The CSV's «Comm/Fee» is commission plus the trade's transaction taxes (stamp duty, levies); Flex lists them apart.
    if (Number(a.taxes || 0) !== 0 && a.tradeID) taxedTrades.add(a.tradeID);
    out.add("Trades", [["DataDiscriminator", "Order"], ["Asset Category", category], ["Currency", a.currency], ["Symbol", a.symbol], ["Date/Time", dateTime], ["Quantity", a.quantity],
      ["T. Price", a.tradePrice], ["Proceeds", a.proceeds], ["Comm/Fee", addDecimals(a.ibCommission, a.taxes)], ["Basis", a.cost], ["Code", code], ...ids]);
  }

  // Cash transactions: one row per transactionID (a query with both detail and summary would list it twice).
  const seenCash = new Set<string>();
  for (const e of detailRows(items("CashTransactions", "CashTransaction"))) {
    const a = e.attributes;
    if (a.transactionID) {
      if (seenCash.has(a.transactionID)) continue;
      seenCash.add(a.transactionID);
    }
    const target = CASH_SECTIONS[typeKey(a.type ?? "")];
    const date = flexDate(a.reportDate) ?? flexDate(a.dateTime) ?? flexDate(a.settleDate);
    if (!date) throw new IbkrFlexReportError("date_format", "Formato data della Flex Query non supportato: scegli yyyyMMdd");
    if (!target) {
      issues.push({ line: out.records.length + 1, section: "Cash Transactions", severity: "error", message: `Movimento di cassa non supportato: ${(a.type ?? "senza tipo").slice(0, 60)}` });
      continue;
    }
    out.add(target, [["Currency", a.currency], ["Symbol", a.symbol], ["Date", date], ["Description", a.description], ["Amount", a.amount], ["Code", a.code], ["Conid", a.conid], ["Transaction ID", a.transactionID]]);
  }

  for (const e of items("TransactionTaxes", "TransactionTax")) {
    const a = e.attributes;
    // Already in its trade's «Comm/Fee»: counting it again would break the cash reconciliation.
    if ((a.tradeID || a.tradeId) && taxedTrades.has(a.tradeID || a.tradeId)) continue;
    const dateTime = flexDateTime(a.dateTime, a.date ?? a.reportDate);
    if (!dateTime) throw new IbkrFlexReportError("date_format", "Formato data della Flex Query non supportato: scegli yyyyMMdd");
    out.add("Transaction Fees", [["Currency", a.currency], ["Symbol", a.symbol], ["Date/Time", dateTime], ["Description", a.description || a.taxDescription], ["Amount", a.taxAmount ?? a.amount], ["Conid", a.conid], ["Transaction ID", a.transactionID]]);
  }

  for (const e of detailRows(items("CorporateActions", "CorporateAction"))) {
    const a = e.attributes;
    const dateTime = flexDateTime(a.dateTime, a.reportDate);
    if (!dateTime) throw new IbkrFlexReportError("date_format", "Formato data della Flex Query non supportato: scegli yyyyMMdd");
    out.add("Corporate Actions", [["Asset Category", ASSET_CATEGORIES[a.assetCategory] ?? a.assetCategory], ["Currency", a.currency], ["Symbol", a.symbol], ["Report Date", flexDate(a.reportDate) ?? ""], ["Date/Time", dateTime],
      ["Description", a.description], ["Quantity", a.quantity], ["Proceeds", a.proceeds ?? "0"], ["Value", a.value], ["Realized P/L", a.fifoPnlRealized], ["Code", a.code], ["Conid", a.conid], ["Transaction ID", a.transactionID]]);
  }

  // Position transfers (ACATS, internal) are refused by the reader, as in the CSV: their cost basis is not in the report.
  for (const e of items("Transfers", "Transfer")) {
    const a = e.attributes;
    out.add("Transfers", [["Asset Category", ASSET_CATEGORIES[a.assetCategory] ?? a.assetCategory], ["Currency", a.currency], ["Symbol", a.symbol], ["Date", flexDate(a.date ?? a.reportDate) ?? ""], ["Description", a.description], ["Quantity", a.quantity], ["Conid", a.conid], ["Transaction ID", a.transactionID]]);
  }

  // Open positions are a dated snapshot (`toDate` close), never a live price.
  for (const e of positions) {
    const a = e.attributes;
    out.add("Open Positions", [["DataDiscriminator", "Summary"], ["Asset Category", ASSET_CATEGORIES[a.assetCategory] ?? a.assetCategory], ["Currency", a.currency], ["Symbol", a.symbol], ["Quantity", a.position],
      ["Cost Basis", a.costBasisMoney], ["Close Price", a.markPrice], ["Value", a.positionValue], ["Unrealized P/L", a.fifoPnlUnrealized], ["Conid", a.conid]]);
  }

  for (const e of items("CashReport", "CashReportCurrency")) {
    const a = e.attributes;
    if (!/^[A-Z]{3}$/.test(a.currency ?? "")) continue; // `BASE_SUMMARY` totals every currency in the base one
    if (a.levelOfDetail && !/^Currency$/i.test(a.levelOfDetail)) continue;
    out.add("Cash Report", [["Currency Summary", "Starting Cash"], ["Currency", a.currency], ["Total", a.startingCash]]);
    out.add("Cash Report", [["Currency Summary", "Commissions"], ["Currency", a.currency], ["Total", addDecimals(a.commissions ?? "0", a.transactionTax) ?? "0"]]);
    out.add("Cash Report", [["Currency Summary", "Ending Cash"], ["Currency", a.currency], ["Total", a.endingCash]]);
  }

  // NAV by asset class from the first and last day of the equity summary, in the base currency. A component the
  // reader does not list (accruals of exotic products) is kept as «Other», so the classes still add up to the total.
  const days = childrenNamed(section("EquitySummaryInBase")!, "EquitySummaryByReportDateInBase").filter((e) => flexDate(e.attributes.reportDate)).sort((x, y) => flexDate(x.attributes.reportDate)!.localeCompare(flexDate(y.attributes.reportDate)!));
  if (days.length) {
    const first = days[0].attributes, last = days.at(-1)!.attributes;
    const classes: [string, string][] = [["Cash", "cash"], ["Stock", "stock"], ["Options", "options"], ["Commodities", "commodities"], ["Bonds", "bonds"], ["Funds", "funds"], ["Crypto", "crypto"], ["Interest Accruals", "interestAccruals"], ["Dividend Accruals", "dividendAccruals"]];
    const num = (raw: string | undefined) => (raw && /^[+-]?\d+(\.\d+)?$/.test(raw.trim()) ? Number(raw) : 0);
    const residual = (row: Record<string, string>) => num(row.total) - classes.reduce((sum, [, key]) => sum + num(row[key]), 0);
    for (const [label, key] of classes) {
      if (key === "cash" || num(first[key]) !== 0 || num(last[key]) !== 0) out.add("Net Asset Value", [["Asset Class", label], ["Prior Total", first[key] ?? "0"], ["Current Total", last[key] ?? "0"]]);
    }
    if (Math.abs(residual(first)) > 0.005 || Math.abs(residual(last)) > 0.005) out.add("Net Asset Value", [["Asset Class", "Other"], ["Prior Total", residual(first).toFixed(6)], ["Current Total", residual(last).toFixed(6)]]);
    out.add("Net Asset Value", [["Asset Class", "Total"], ["Prior Total", first.total], ["Current Total", last.total]]);
  }

  const parsed = readInteractiveBrokersRecords(out.records, todayKey);
  return { ...parsed, issues: [...issues, ...parsed.issues] };
}

/** Account id, base currency, opening date and period of a report, read from its attributes only. */
export function ibkrFlexAccountOf(text: string): { accountId: string; currency: string; dateOpened: string | null; from: string | null; to: string | null } {
  if (!looksLikeIbkrFlex(text)) throw new IbkrFlexReportError("not_flex", "Il file non è un report Flex di Interactive Brokers");
  let root: XmlElement;
  try { root = parseXml(text); } catch { throw new IbkrFlexReportError("malformed", "Report Flex non leggibile (XML non valido)"); }
  const statements = childrenNamed(childNamed(root, "FlexStatements") ?? root, "FlexStatement");
  if (statements.length !== 1) throw new IbkrFlexReportError("multiple_accounts", "La Flex Query deve riguardare un solo conto");
  const info = childNamed(statements[0], "AccountInformation");
  const accountId = info?.attributes.accountId || statements[0].attributes.accountId || "";
  if (!accountId) throw new IbkrFlexReportError("missing_sections", "Nella Flex Query mancano le sezioni: Account Information", ["Account Information"]);
  return { accountId, currency: info?.attributes.currency ?? "", dateOpened: flexDate(info?.attributes.dateOpened), from: flexDate(statements[0].attributes.fromDate), to: flexDate(statements[0].attributes.toDate) };
}
