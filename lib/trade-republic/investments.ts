import { z } from "zod";
import { isValidIsin } from "@/lib/validation/investments";
import { TradeRepublicError } from "./client";
import { describeShape, maskPattern, tradeRepublicDebug } from "./debug";
import type { TradeRepublicInvestmentEvent } from "./data";
import type { TradeRepublicReader } from "./socket";

/** One executed securities event, in EUR (the only account currency supported). */
export interface TradeRepublicTrade {
  eventId: string;
  eventType: string;
  date: string;
  isin: string;
  name: string | null;
  side: "acquisto" | "vendita";
  quantity: number;
  price: number;
  fees: number;
  taxes: number;
}
export interface TradeRepublicInvestments {
  trades: TradeRepublicTrade[];
  /** Shares per ISIN as Trade Republic reports them now; null when the positions topic could not be read. */
  positions: Map<string, number> | null;
}

const MAX_DETAILS = 2000;
const MAX_DETAIL_FETCH_MS = 120_000;
const MAX_WALK_DEPTH = 14;
const ISIN_PATTERN = /[A-Z]{2}[A-Z0-9]{9}\d/;
// Shares granted by Trade Republic (Saveback, referral rewards): no money of the user, priced at execution.
const FREE_SHARE_TYPES = new Set(["SAVEBACK_PAYOUT", "REFERRAL_FIRST_TRADE_EXECUTED_INVITER"]);
// Executions whose detail must carry shares and price. Corporate actions need their own mapping: they fail loudly.
const TRADE_TYPES = new Set(["TRADING_TRADE_EXECUTED", "TRADING_SAVINGSPLAN_EXECUTED", "SAVINGS_PLAN_EXECUTED", "ORDER_EXECUTED", "TRADE_INVOICE", ...FREE_SHARE_TYPES]);
/** Row titles of the detail tables (English locale, set when the socket connects). */
const FIELDS = {
  quantity: /^(shares|quantity|units)$/i,
  price: /^(share price|price|execution price|price per share)$/i,
  fee: /^(fee|fees|order fee|external fee)$/i,
  tax: /^(tax|taxes|withholding tax|capital gains tax)$/i,
  asset: /^(asset|instrument|security)$/i,
};
/** Tolerance between shares × price and the booked amount: fees, taxes and rounding of the shown price. */
const AMOUNT_TOLERANCE = 0.05;

const positionsSchema = z.object({
  positions: z.array(z.object({ instrumentId: z.string(), netSize: z.union([z.number(), z.string()]).transform(Number).pipe(z.number().finite()) })),
});

interface DetailRow { title: string; text: string }

/** Every `{ title, detail: { text } }` row and every ISIN in action payloads or logo paths, at any depth. */
function walkDetail(node: unknown, rows: DetailRow[], isins: Set<string>, depth = 0): void {
  if (depth > MAX_WALK_DEPTH || node === null || typeof node !== "object") return;
  if (Array.isArray(node)) { for (const child of node) walkDetail(child, rows, isins, depth + 1); return; }
  const record = node as Record<string, unknown>;
  const detail = record.detail as Record<string, unknown> | undefined;
  if (typeof record.title === "string" && detail && typeof detail === "object" && typeof detail.text === "string") rows.push({ title: record.title.trim(), text: detail.text });
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string" && (key === "payload" || key === "icon" || key === "asset")) {
      const match = ISIN_PATTERN.exec(value);
      if (match && isValidIsin(match[0])) isins.add(match[0]);
    } else walkDetail(value, rows, isins, depth + 1);
  }
}

/** A number shown by TR in the English locale (`€1,234.56`, `0.123456`, `Free`); NaN when there is none. */
export function parseShownNumber(text: string): number {
  if (/\b(free|gratis|kostenlos)\b/i.test(text)) return 0;
  const cleaned = text.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(cleaned)) return Number.NaN;
  const lastComma = cleaned.lastIndexOf(",");
  // A lone comma not followed by exactly three digits is a decimal separator (`0,5`); otherwise commas group thousands.
  const decimalComma = !cleaned.includes(".") && lastComma >= 0 && cleaned.length - lastComma - 1 !== 3;
  return Number(decimalComma ? cleaned.replace(",", ".") : cleaned.replace(/,/g, ""));
}

/** Staging/trail description of a detail: section types and masked titles, row titles and value formats. Never values. */
function describeDetail(detail: unknown, rows: DetailRow[]) {
  const sections = detail && typeof detail === "object" && "sections" in detail && Array.isArray(detail.sections) ? detail.sections as Record<string, unknown>[] : [];
  return {
    sections: sections.map((section) => `${String(section?.type ?? "?")}:${maskPattern(String(section?.title ?? ""))}`),
    rows: rows.map((row) => `${maskPattern(row.title)}=${maskPattern(row.text)}`),
    shape: describeShape(detail),
  };
}

/**
 * Read the detail of every securities event and the current positions on the open reader. Unknown event types and
 * details that cannot be read fail together after the whole list, with the structure of one example per problem.
 * Positions are read last: an upstream error on that topic closes the socket and only disables the quantity check.
 */
export async function readTradeRepublicInvestments(reader: TradeRepublicReader, events: TradeRepublicInvestmentEvent[]): Promise<TradeRepublicInvestments> {
  if (events.length > MAX_DETAILS) { tradeRepublicDebug("rejected", { check: "too-many-investment-events", count: events.length }); throw new TradeRepublicError("invalid-response"); }
  const startedAt = Date.now();
  const trades: TradeRepublicTrade[] = [];
  const problems = new Map<string, { count: number; example: unknown }>();
  const note = (check: string, event: TradeRepublicInvestmentEvent, example: unknown) => {
    const key = `${check} ${event.eventType}`;
    const found = problems.get(key);
    if (found) found.count++; else problems.set(key, { count: 1, example });
  };
  for (const event of events) {
    if (Date.now() - startedAt > MAX_DETAIL_FETCH_MS) { tradeRepublicDebug("rejected", { check: "investment-detail-timeout" }); throw new TradeRepublicError("unavailable"); }
    if (!TRADE_TYPES.has(event.eventType)) { note("unsupported-investment-event", event, null); continue; }
    const detail = await reader.read("timelineDetailV2", { id: event.id });
    const rows: DetailRow[] = [];
    const isins = new Set<string>();
    walkDetail(detail, rows, isins);
    const field = (pattern: RegExp) => rows.find((row) => pattern.test(row.title))?.text;
    const quantity = parseShownNumber(field(FIELDS.quantity) ?? "");
    const price = parseShownNumber(field(FIELDS.price) ?? "");
    const feeText = field(FIELDS.fee);
    const taxText = field(FIELDS.tax);
    const fees = feeText === undefined ? 0 : Math.abs(parseShownNumber(feeText));
    const taxes = taxText === undefined ? 0 : Math.abs(parseShownNumber(taxText));
    const free = FREE_SHARE_TYPES.has(event.eventType);
    if (isins.size !== 1) { note(isins.size ? "several-isins" : "missing-isin", event, describeDetail(detail, rows)); continue; }
    if (!(quantity > 0) || !(price > 0) || !Number.isFinite(fees) || !Number.isFinite(taxes)) { note("missing-quantity-or-price", event, describeDetail(detail, rows)); continue; }
    const side = free || event.amount < 0 ? "acquisto" : "vendita";
    // Cross-check the parse against the booked cash amount: a wrong row would otherwise import silently.
    if (!free && Math.abs(quantity * price - Math.abs(event.amount)) > fees + taxes + AMOUNT_TOLERANCE + Math.abs(event.amount) * 0.005) {
      note("amount-mismatch", event, describeDetail(detail, rows)); continue;
    }
    trades.push({ eventId: event.id, eventType: event.eventType, date: event.date, isin: [...isins][0], name: field(FIELDS.asset)?.trim() || null, side, quantity, price, fees: free ? 0 : fees, taxes });
  }
  tradeRepublicDebug("investments.read", { events: events.length, trades: trades.length, problems: problems.size, types: Object.fromEntries([...new Set(events.map((e) => e.eventType))].map((type) => [type, events.filter((e) => e.eventType === type).length])) });
  if (problems.size) {
    tradeRepublicDebug("investments.problems", { findings: [...problems.entries()].map(([key, found]) => ({ key, count: found.count, example: found.example })) });
    throw new TradeRepublicError("invalid-response");
  }
  return { trades, positions: await readPositions(reader) };
}

async function readPositions(reader: TradeRepublicReader): Promise<Map<string, number> | null> {
  try {
    const raw = await reader.read("compactPortfolio");
    const parsed = positionsSchema.safeParse(raw);
    if (!parsed.success) { tradeRepublicDebug("positions.unreadable", { shape: describeShape(raw) }); return null; }
    return new Map(parsed.data.positions.filter((p) => isValidIsin(p.instrumentId)).map((p) => [p.instrumentId, p.netSize]));
  } catch (error) {
    tradeRepublicDebug("positions.unavailable", { reason: error instanceof TradeRepublicError ? error.reason : "internal" });
    return null;
  }
}

/**
 * Check imported trades against Trade Republic's own positions: every ISIN must end at the reported quantity. Returns
 * the number of mismatched ISINs (0 = consistent) and logs only counts and ISINs, never quantities.
 */
export function positionMismatches(trades: TradeRepublicTrade[], positions: Map<string, number>): number {
  const totals = new Map<string, number>();
  for (const trade of trades) totals.set(trade.isin, (totals.get(trade.isin) ?? 0) + (trade.side === "acquisto" ? trade.quantity : -trade.quantity));
  const isins = new Set([...totals.keys(), ...positions.keys()]);
  const mismatched = [...isins].filter((isin) => Math.abs((totals.get(isin) ?? 0) - (positions.get(isin) ?? 0)) > 1e-6);
  if (mismatched.length) tradeRepublicDebug("rejected", { check: "positions-mismatch", mismatched, onlyInTimeline: mismatched.filter((isin) => !positions.has(isin)).length, onlyInPortfolio: mismatched.filter((isin) => !totals.has(isin)).length });
  return mismatched.length;
}
