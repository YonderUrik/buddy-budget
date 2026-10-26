import { z } from "zod";
import { isValidIsin } from "@/lib/validation/investments";
import { TradeRepublicError } from "./client";
import { countBy, describeShape, maskPattern, tradeRepublicDebug } from "./debug";
import type { TradeRepublicReader, TradeRepublicTopic } from "./socket";

/**
 * Securities history from Trade Republic, following the rules of pytr (github.com/pytr-org/pytr, `event.py`,
 * `timeline.py`), the maintained open-source client: both timelines, details only for items that point at their own
 * detail, cancellations ignored, buy or sell from the sign of the booked amount, rows read in the German locale.
 */

/** One securities operation in EUR: a trade, or shares received without paying (`rettifica`, cost = `grossAmount`). */
export interface TradeRepublicTrade {
  eventId: string;
  eventType: string;
  date: string;
  isin: string;
  name: string | null;
  side: "acquisto" | "vendita" | "rettifica";
  quantity: number;
  price: number;
  grossAmount: number | null;
  fees: number;
  taxes: number;
  /** German subtitle of the timeline item (e.g. `Kauforder`), kept for diagnostics only. */
  subtitle: string | null;
}
export interface TradeRepublicInvestments {
  trades: TradeRepublicTrade[];
  /** Shares per ISIN as Trade Republic reports them now; null when the positions could not be read. */
  positions: Map<string, number> | null;
}

const MAX_PAGES = 200;
const MAX_EVENTS = 20_000;
const MAX_DETAILS = 2000;
const MAX_FETCH_MS = 180_000;
const MAX_WALK_DEPTH = 14;
/** Two copies of one legacy order are at most this far apart (pytr `is_likely_same_but_newer`). */
const LEGACY_DUPLICATE_MS = 500;

/** pytr `ConditionalEventType.TRADE_INVOICE`: buy or sell, by the sign of the booked amount. */
const TRADE_TYPES = new Set(["BENEFITS_SPARE_CHANGE_EXECUTION", "IPO_TRADE_EXECUTED", "ORDER_EXECUTED", "SAVINGS_PLAN_EXECUTED", "SAVINGS_PLAN_INVOICE_CREATED", "SPARE_CHANGE_AGGREGATE", "TRADE_CORRECTED", "TRADE_INVOICE", "TRADING_SAVINGSPLAN_EXECUTED", "TRADING_TRADE_EXECUTED"]);
/** Shares paid by Trade Republic (pytr `SAVEBACK`, plus referral and Saveback payouts): no money of the user. */
const FREE_SHARE_TYPES = new Set(["ACQUISITION_TRADE_PERK", "BENEFITS_SAVEBACK_EXECUTION", "SAVEBACK_AGGREGATE", "SAVEBACK_PAYOUT", "REFERRAL_FIRST_TRADE_EXECUTED_INVITER"]);
const TRANSFER_IN_TYPES = new Set(["SSP_SECURITIES_TRANSFER_INCOMING"]);
/** Securities events this importer does not map yet: they fail the import loudly instead of moving holdings silently. */
const UNSUPPORTED_TYPES = new Set(["SSP_CORPORATE_ACTION_INVOICE_SHARES", "SSP_CORPORATE_ACTION_SECURITIES", "PRIVATE_MARKET_FUND_TRADE_EXECUTED", "PRIVATE_MARKETS_ORDER_CREATED", "PRIVATE_MARKETS_TRADE_EXECUTED"]);
const LEGACY_TYPE = "TIMELINE_LEGACY_MIGRATED_EVENTS";
const LEGACY_TRADE_SUBTITLES = new Set(["Kauforder", "Limit-Buy-Order", "Limit-Sell-Order", "Limit Verkauf-Order neu abgerechnet", "Sparplan ausgeführt", "Stop-Sell-Order", "Verkaufsorder"]);
/** pytr `events_known_ignored_subtitle`: cancelled, rejected, expired or merely created orders. */
const IGNORED_SUBTITLES = new Set(["Kauf-Abrechnung storniert", "Kauforder abgelehnt", "Kauforder storniert", "Limit-Buy-Order abgelaufen", "Limit-Buy-Order erstellt", "Limit-Buy-Order storniert", "Limit Kauf-Abrechnung storniert", "Limit-Sell-Order abgelaufen", "Limit-Sell-Order abgelehnt", "Limit-Sell-Order erstellt", "Limit-Sell-Order storniert", "Limit Verkauf-Abrechnung storniert", "Sparplan fehlgeschlagen", "Stop-Market Verkauf-Abrechnung storniert", "Stop-Sell-Order storniert", "Verkaufsorder abgelehnt"]);
const DUPLICATE_PRONE_SUBTITLES = new Set(["Limit-Sell-Order", "Limit-Buy-Order", "Sparplan ausgeführt"]);
/** Detail row titles (German locale, English kept as fallback, as in pytr). */
const SHARE_ROWS = new Set(["Aktien", "Anteile", "Shares", "Aktien hinzugefügt", "Aktien entfernt"]);
const FEE_ROWS = new Set(["Gebühr", "Fee"]);
const TAX_ROWS = new Set(["Steuer", "Steuern"]);
const ASSET_ROWS = new Set(["Vermögenswert", "Wertpapier", "Asset"]);

const itemSchema = z.object({
  id: z.string().min(1).max(200),
  timestamp: z.string(),
  eventType: z.string().nullish(),
  title: z.string().nullish(),
  subtitle: z.string().nullish(),
  status: z.string().nullish(),
  amount: z.object({ value: z.number().finite() }).nullish(),
  action: z.object({ type: z.string().nullish(), payload: z.unknown() }).nullish(),
});
const pageSchema = z.object({ items: z.array(z.unknown()), cursors: z.object({ after: z.string().nullable().optional() }).optional() });
type TimelineItem = z.infer<typeof itemSchema>;
type Kind = "trade" | "free" | "transfer-in" | "transfer-legacy" | "unsupported";

/** All items of one timeline, by cursor. Malformed items are counted, never guessed. */
async function readTimeline(reader: TradeRepublicReader, topic: TradeRepublicTopic, deadline: number): Promise<{ items: TimelineItem[]; malformed: number }> {
  const items: TimelineItem[] = [];
  const cursors = new Set<string>();
  let after: string | undefined;
  let malformed = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    if (Date.now() > deadline) { tradeRepublicDebug("rejected", { check: "investment-timeline-timeout", topic }); throw new TradeRepublicError("unavailable"); }
    const raw = await reader.read(topic, after ? { after } : undefined);
    const parsed = pageSchema.safeParse(raw);
    if (!parsed.success) { tradeRepublicDebug("rejected", { check: "investment-page-schema", topic, shape: describeShape(raw) }); throw new TradeRepublicError("invalid-response"); }
    for (const rawItem of parsed.data.items) {
      const item = itemSchema.safeParse(rawItem);
      if (item.success) items.push(item.data); else malformed++;
    }
    if (items.length > MAX_EVENTS) { tradeRepublicDebug("rejected", { check: "too-many-investment-events", topic }); throw new TradeRepublicError("invalid-response"); }
    const cursor = parsed.data.cursors?.after;
    if (!cursor) return { items, malformed };
    if (cursors.has(cursor)) { tradeRepublicDebug("rejected", { check: "investment-repeated-cursor", topic }); throw new TradeRepublicError("invalid-response"); }
    cursors.add(cursor); after = cursor;
  }
  tradeRepublicDebug("rejected", { check: "investment-too-many-pages", topic });
  throw new TradeRepublicError("invalid-response");
}

/** Which securities operation an item is, or null when it is not one (cash, notices, cancellations). */
export function classifyItem(item: Pick<TimelineItem, "eventType" | "subtitle" | "status">): Kind | null {
  const type = (item.eventType ?? "").toUpperCase();
  if ((item.status ?? "").toLowerCase() === "canceled" || (item.subtitle && IGNORED_SUBTITLES.has(item.subtitle))) return null;
  if (TRADE_TYPES.has(type)) return "trade";
  if (FREE_SHARE_TYPES.has(type)) return "free";
  if (TRANSFER_IN_TYPES.has(type)) return "transfer-in";
  if (UNSUPPORTED_TYPES.has(type)) return "unsupported";
  if (type === LEGACY_TYPE && item.subtitle) {
    if (LEGACY_TRADE_SUBTITLES.has(item.subtitle)) return "trade";
    if (item.subtitle === "Aktien erhalten") return "transfer-in";
    if (item.subtitle === "Aktien übertragen" || item.subtitle === "Wertpapiertransfer") return "transfer-legacy";
  }
  return null;
}

/** pytr `is_likely_same_but_newer`: legacy limit orders and savings plans sometimes appear twice, 0-500 ms apart. */
function dropLegacyDuplicates(items: TimelineItem[]): { kept: TimelineItem[]; dropped: number } {
  const time = (item: TimelineItem) => Date.parse(normalizeTimestamp(item.timestamp));
  const older = new Set<string>();
  for (const item of items) {
    if (!item.subtitle || !DUPLICATE_PRONE_SUBTITLES.has(item.subtitle)) continue;
    const newer = items.some((other) => other.id !== item.id && other.title === item.title && other.subtitle === item.subtitle
      && time(other) - time(item) >= 0 && time(other) - time(item) <= LEGACY_DUPLICATE_MS && (time(other) > time(item) || other.id > item.id));
    if (newer) older.add(item.id);
  }
  return { kept: items.filter((item) => !older.has(item.id)), dropped: older.size };
}

/** `+0000` → `+00:00`, as pytr does before parsing. */
function normalizeTimestamp(timestamp: string): string {
  return /[+-]\d{4}$/.test(timestamp) ? `${timestamp.slice(0, -2)}:${timestamp.slice(-2)}` : timestamp;
}

interface DetailRow { title: string; text: string }

/** Every `{ title, detail: { text } }` row at any depth (including the nested `Transaktion` table). */
function detailRows(node: unknown, rows: DetailRow[] = [], depth = 0): DetailRow[] {
  if (depth > MAX_WALK_DEPTH || node === null || typeof node !== "object") return rows;
  if (Array.isArray(node)) { for (const child of node) detailRows(child, rows, depth + 1); return rows; }
  const record = node as Record<string, unknown>;
  const detail = record.detail as Record<string, unknown> | undefined;
  if (typeof record.title === "string" && detail && typeof detail === "object" && typeof detail.text === "string") rows.push({ title: record.title.trim(), text: detail.text });
  for (const value of Object.values(record)) detailRows(value, rows, depth + 1);
  return rows;
}

/** pytr `_parse_isin`: the instrument action of a section, else the header icon `logos/<ISIN>/v2`. */
export function detailIsin(detail: unknown): string | null {
  const sections = sectionsOf(detail);
  let raw: unknown = null;
  for (const section of sections) {
    const action = section.action as { type?: unknown; payload?: unknown } | null | undefined;
    if (action && action.type === "instrumentDetail") { raw = action.payload; break; }
    if (section.type === "header") {
      const icon = (section.data as { icon?: unknown } | undefined)?.icon;
      raw = icon && typeof icon === "object" ? (icon as { asset?: unknown }).asset : icon;
      break;
    }
  }
  if (typeof raw !== "string" || !raw) return null;
  const candidate = raw.slice(raw.indexOf("/") + 1).split("/", 1)[0];
  return isValidIsin(candidate) ? candidate : null;
}

function sectionsOf(detail: unknown): Record<string, unknown>[] {
  return detail && typeof detail === "object" && "sections" in detail && Array.isArray(detail.sections) ? detail.sections as Record<string, unknown>[] : [];
}

/** True when the detail header says the event was cancelled (pytr checks it besides the item status). */
function headerCanceled(detail: unknown): boolean {
  const header = sectionsOf(detail).find((section) => section.type === "header");
  return String((header?.data as { status?: unknown } | undefined)?.status ?? "").toLowerCase() === "canceled";
}

/**
 * A number as Trade Republic shows it, German locale first (`1.234,56 €`, `0,5`), English as fallback (`0.123456`);
 * NaN when there is none. Mirrors pytr's `_parse_float_from_text_value` with `pref_locale="de"`.
 */
export function parseShownNumber(text: string): number {
  if (/\b(kostenlos|gratis|free)\b/i.test(text)) return 0;
  const cleaned = text.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(cleaned)) return Number.NaN;
  if (cleaned.includes(",")) return Number(cleaned.replace(/\./g, "").replace(",", "."));
  // Dots only: German thousands groups (`1.234`, `12.345.678`) or an English decimal (`0.5`).
  return /^-?\d{1,3}(\.\d{3})+$/.test(cleaned) ? Number(cleaned.replace(/\./g, "")) : Number(cleaned);
}

/** Description of a detail for diagnostics: section types and masked titles, row titles and value formats. Never values. */
function describeDetail(detail: unknown, rows: DetailRow[]) {
  return {
    sections: sectionsOf(detail).map((section) => `${String(section?.type ?? "?")}:${maskPattern(String(section?.title ?? ""))}`),
    rows: rows.map((row) => `${row.title}=${maskPattern(row.text)}`),
    shape: describeShape(detail),
  };
}

/**
 * Read the securities history on an open German-locale reader: both timelines, the detail of every securities item,
 * then the positions. Problems are collected over the whole history and fail it together, with one example per kind.
 */
export async function readTradeRepublicInvestments(reader: TradeRepublicReader, options: { securitiesAccountNumber: string | null }): Promise<TradeRepublicInvestments> {
  const deadline = Date.now() + MAX_FETCH_MS;
  const transactions = await readTimeline(reader, "timelineTransactions", deadline);
  const activity = await readTimeline(reader, "timelineActivityLog", deadline);
  const byId = new Map<string, TimelineItem>();
  for (const item of [...transactions.items, ...activity.items]) byId.set(item.id, item);
  const classified = [...byId.values()].map((item) => ({ item, kind: classifyItem(item) })).filter((entry): entry is { item: TimelineItem; kind: Kind } => entry.kind !== null);
  const { kept, dropped } = dropLegacyDuplicates(classified.map((entry) => entry.item));
  const kindOf = new Map(classified.map((entry) => [entry.item.id, entry.kind]));
  if (kept.length > MAX_DETAILS) { tradeRepublicDebug("rejected", { check: "too-many-investment-events", count: kept.length }); throw new TradeRepublicError("invalid-response"); }

  const trades: TradeRepublicTrade[] = [];
  const skipped: Record<string, number> = {};
  const skip = (reason: string) => { skipped[reason] = (skipped[reason] ?? 0) + 1; };
  const problems = new Map<string, { count: number; example: unknown }>();
  const note = (check: string, item: TimelineItem, example: unknown) => {
    const key = `${check} ${item.eventType ?? "?"}${item.subtitle ? `/${item.subtitle}` : ""}`;
    const found = problems.get(key);
    if (found) found.count++; else problems.set(key, { count: 1, example });
  };

  for (const item of kept) {
    let kind = kindOf.get(item.id)!;
    if (kind === "unsupported") { note("unsupported-investment-event", item, null); continue; }
    // Only items that point at their own detail have one (pytr); a reward without it granted no share.
    const hasDetail = item.action?.type === "timelineDetail" && item.action.payload === item.id;
    if (!hasDetail) { if (kind === "free") skip("reward-without-detail"); else note("missing-detail", item, { action: item.action?.type ?? null }); continue; }
    if (Date.now() > deadline) { tradeRepublicDebug("rejected", { check: "investment-detail-timeout" }); throw new TradeRepublicError("unavailable"); }
    const detail = await reader.read("timelineDetailV2", { id: item.id });
    if (headerCanceled(detail)) { skip("canceled"); continue; }
    const rows = detailRows(detail);
    if (kind === "transfer-legacy") {
      const titles = sectionsOf(detail).map((section) => String(section.title ?? ""));
      if (titles.some((title) => title.includes("erhalten"))) kind = "transfer-in";
      else { note("unsupported-transfer-out", item, describeDetail(detail, rows)); continue; }
    }
    const row = (names: Set<string>) => rows.find((candidate) => names.has(candidate.title))?.text;
    const isin = detailIsin(detail);
    const quantity = parseShownNumber(row(SHARE_ROWS) ?? "");
    const feeText = row(FEE_ROWS);
    const taxText = row(TAX_ROWS);
    const fees = feeText === undefined ? 0 : Math.abs(parseShownNumber(feeText));
    const taxes = taxText === undefined ? 0 : Math.abs(parseShownNumber(taxText));
    if (!isin) { note("missing-isin", item, describeDetail(detail, rows)); continue; }
    if (!(quantity > 0) || !Number.isFinite(fees) || !Number.isFinite(taxes)) { note("missing-shares", item, describeDetail(detail, rows)); continue; }
    const base = { eventId: item.id, eventType: item.eventType ?? "", date: item.timestamp.slice(0, 10), isin, name: row(ASSET_ROWS)?.trim() || item.title?.trim() || null, quantity, subtitle: item.subtitle ?? null };
    if (kind === "free" || kind === "transfer-in") {
      // Received shares: quantity and (for rewards) their value at booking, with no money of the user.
      trades.push({ ...base, side: "rettifica", price: 0, grossAmount: kind === "free" && item.amount ? Math.abs(item.amount.value) : 0, fees: 0, taxes: 0 });
      continue;
    }
    const value = item.amount?.value;
    if (value === undefined || value === 0) { note("missing-amount", item, describeDetail(detail, rows)); continue; }
    const side = value < 0 ? "acquisto" : "vendita";
    // Price from the booked total: a buy paid shares × price + costs, a sale received shares × price − costs.
    const price = (side === "acquisto" ? Math.abs(value) - fees - taxes : value + fees + taxes) / quantity;
    if (!(price > 0)) { note("non-positive-price", item, describeDetail(detail, rows)); continue; }
    trades.push({ ...base, side, price, grossAmount: null, fees, taxes });
  }

  tradeRepublicDebug("investments.read", {
    timelineItems: transactions.items.length, activityItems: activity.items.length, malformed: transactions.malformed + activity.malformed,
    candidates: classified.length, legacyDuplicates: dropped, trades: trades.length, skipped, problems: problems.size,
    kinds: countBy(classified, (entry) => `${entry.kind}:${entry.item.eventType ?? "?"}`),
  });
  if (problems.size) {
    tradeRepublicDebug("investments.problems", { findings: [...problems.entries()].map(([key, found]) => ({ key, count: found.count, example: found.example })) });
    throw new TradeRepublicError("invalid-response");
  }
  return { trades, positions: await readPositions(reader, options.securitiesAccountNumber) };
}

const positionSchema = z.object({ netSize: z.union([z.number(), z.string()]).transform(Number).pipe(z.number().finite()), isin: z.string().optional(), instrumentId: z.string().optional() });

/** Current positions (pytr `compactPortfolioByType`): `categories[].positions[]` keyed by `isin`. */
async function readPositions(reader: TradeRepublicReader, securitiesAccountNumber: string | null): Promise<Map<string, number> | null> {
  if (!securitiesAccountNumber) { tradeRepublicDebug("positions.unavailable", { reason: "no-securities-account" }); return null; }
  try {
    const raw = await reader.read("compactPortfolioByType", { secAccNo: securitiesAccountNumber });
    const categories = raw && typeof raw === "object" && "categories" in raw && Array.isArray(raw.categories) ? raw.categories as { positions?: unknown }[] : null;
    if (!categories) { tradeRepublicDebug("positions.unreadable", { shape: describeShape(raw) }); return null; }
    const positions = new Map<string, number>();
    for (const category of categories) for (const rawPosition of Array.isArray(category?.positions) ? category.positions : []) {
      const position = positionSchema.safeParse(rawPosition);
      const isin = position.success ? position.data.isin ?? position.data.instrumentId : undefined;
      if (!position.success || !isin || !isValidIsin(isin)) { tradeRepublicDebug("positions.unreadable", { shape: describeShape(rawPosition) }); return null; }
      positions.set(isin, (positions.get(isin) ?? 0) + position.data.netSize);
    }
    tradeRepublicDebug("positions.read", { instruments: positions.size });
    return positions;
  } catch (error) {
    tradeRepublicDebug("positions.unavailable", { reason: error instanceof TradeRepublicError ? error.reason : "internal", codes: error && typeof error === "object" && "codes" in error ? (error as { codes: string[] }).codes : undefined });
    return null;
  }
}

/** Shares held per ISIN after the trades, the way positions count them (adjustments add, sales subtract). */
function quantities(trades: TradeRepublicTrade[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const trade of trades) totals.set(trade.isin, (totals.get(trade.isin) ?? 0) + (trade.side === "vendita" ? -trade.quantity : trade.quantity));
  return totals;
}

/**
 * Check imported trades against Trade Republic's own positions: every ISIN must end at the reported quantity. Returns
 * the number of mismatched ISINs (0 = consistent); the log carries the instruments' order, never ISINs or quantities.
 */
export function positionMismatches(trades: TradeRepublicTrade[], positions: Map<string, number>): number {
  const totals = quantities(trades);
  const isins = [...new Set([...totals.keys(), ...positions.keys()])];
  const mismatched = isins.filter((isin) => Math.abs((totals.get(isin) ?? 0) - (positions.get(isin) ?? 0)) > 1e-6);
  if (mismatched.length) tradeRepublicDebug("rejected", {
    check: "positions-mismatch", mismatched: mismatched.length,
    onlyInHistory: mismatched.filter((isin) => !positions.has(isin)).length, onlyInPortfolio: mismatched.filter((isin) => !totals.has(isin)).length,
    sequences: mismatched.slice(0, 5).map((isin) => tradeSequence(trades, isin)),
  });
  return mismatched.length;
}

/** Order of one instrument's operations for diagnostics: date, type, subtitle and side, never ISIN or quantity. */
export function tradeSequence(trades: TradeRepublicTrade[], isin: string) {
  return trades.filter((trade) => trade.isin === isin).sort((a, b) => a.date.localeCompare(b.date)).map((trade) => `${trade.date} ${trade.eventType}${trade.subtitle ? `/${trade.subtitle}` : ""} ${trade.side}`);
}
