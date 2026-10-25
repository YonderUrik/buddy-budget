import { z } from "zod";
import { TradeRepublicError } from "./client";
import type { TradeRepublicReader } from "./socket";
import { countBy, describeIssues, describeShape, maskPattern, tradeRepublicDebug } from "./debug";

// TR sends Java-style offsets without a colon (`+0000`), which zod 4's `datetime({ offset: true })` rejects.
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;
const decimal = z.union([z.number(), z.string().regex(/^[+-]?\d+(?:\.\d+)?$/)]).transform(Number).pipe(z.number().finite());
const cashSchema = z.array(z.object({ currencyId: z.string(), amount: decimal }));
const eventSchema = z.object({
  id: z.string().min(1).max(200), timestamp: z.string().regex(TIMESTAMP), eventType: z.string(),
  title: z.string().max(1000), amount: z.object({ value: decimal, currency: z.string() }).nullish(),
  // TR sends absent optional fields as explicit nulls (e.g. `cashAccountNumber: null`).
  status: z.string().nullish(), cashAccountNumber: z.string().nullish(), deleted: z.boolean().nullish(),
});
const pageSchema = z.object({ items: z.array(eventSchema), cursors: z.object({ after: z.string().nullable().optional() }).optional() });
const MAX_PAGES = 200;
const MAX_FETCH_MS = 240_000;
const MAX_MOVEMENTS = 20_000;
const CASH_TYPES = new Set(["CARD_TRANSACTION", "CARD_REFUND", "CARD_PAYMENT", "CARD_PAYMENT_REFUND", "INTEREST_PAYOUT", "BANK_TRANSACTION_INCOMING", "BANK_TRANSACTION_OUTGOING", "BANK_TRANSACTION_OUTGOING_SEPA", "PAYMENT_INBOUND", "PAYMENT_OUTBOUND", "PAYMENT_INBOUND_GOOGLE_PAY", "INCOMING_TRANSFER", "OUTGOING_TRANSFER", "SSP_TAX_CORRECTION", "TAX_REFUND", "CASH_PAYOUT", "CASH_DEPOSIT", "SSP_CORPORATE_ACTION_CASH", "DIVIDEND", "DIVIDEND_PAYOUT"]);
// Not booked (yet, or ever): skipped; a pending movement arrives on a later sync under the same id.
const UNBOOKED_STATUSES = new Set(["PENDING", "CREATED", "CANCELED", "CANCELLED", "FAILED", "REJECTED", "DECLINED"]);
const BOOKED_STATUSES = new Set(["COMPLETED", "EXECUTED", "SETTLED"]);
const INVESTMENT_TYPES = new Set(["TRADING_SAVINGSPLAN_EXECUTED", "TRADING_TRADE_EXECUTED", "TRADE_INVOICE", "SAVINGS_PLAN_EXECUTED", "SAVEBACK_PAYOUT", "SSP_CORPORATE_ACTION_SECURITIES"]);

export interface TradeRepublicMovement { id: string; date: string; amount: string; description: string }
export interface TradeRepublicCashData { balance: string; movements: TradeRepublicMovement[]; investmentEvents: number }

/** Fetch complete booked cash history. Unknown monetary events block the import instead of disappearing. */
export async function readTradeRepublicCash(reader: TradeRepublicReader, today: string, onProgress?: (count: number) => Promise<void>): Promise<TradeRepublicCashData> {
  const startedAt = Date.now();
  const rawCash = await reader.read("cash");
  const cash = cashSchema.safeParse(rawCash);
  tradeRepublicDebug("cash", { shape: describeShape(rawCash), issues: cash.success ? [] : describeIssues(cash.error.issues), currencies: cash.success ? cash.data.map(entry => entry.currencyId) : undefined });
  if (!cash.success || cash.data.length !== 1 || cash.data[0].currencyId !== "EUR" || Math.abs(cash.data[0].amount) >= 1e10) {
    tradeRepublicDebug("rejected", { check: "cash-balance" });
    throw new TradeRepublicError("invalid-response");
  }
  const movements: TradeRepublicMovement[] = [];
  const seen = new Map<string, string>();
  const cursors = new Set<string>();
  let after: string | undefined;
  let investmentEvents = 0;
  let unbooked = 0;
  const reject = (check: string, details: Record<string, unknown> = {}, reason: "invalid-response" | "unsupported-event" | "unavailable" = "invalid-response") => {
    tradeRepublicDebug("rejected", { check, ...details });
    return new TradeRepublicError(reason);
  };
  for (let page = 0; page < MAX_PAGES; page++) {
    if (Date.now() - startedAt > MAX_FETCH_MS) throw reject("fetch-timeout", { page }, "unavailable");
    const rawPage = await reader.read("timelineTransactions", after);
    debugPage(page, rawPage);
    const parsed = pageSchema.safeParse(rawPage);
    if (!parsed.success) throw reject("page-schema", { page, issues: describeIssues(parsed.error.issues) });
    for (const event of parsed.data.items) {
      const fingerprint = JSON.stringify(event);
      if (seen.has(event.id)) {
        if (seen.get(event.id) !== fingerprint) throw reject("duplicate-id-changed", { page, eventType: event.eventType });
        continue;
      }
      seen.set(event.id, fingerprint);
      if (seen.size > MAX_MOVEMENTS) throw reject("too-many-events", { page });
      if (!event.amount) continue;
      if (event.deleted) { unbooked++; continue; }
      if (event.status && !BOOKED_STATUSES.has(event.status)) {
        if (UNBOOKED_STATUSES.has(event.status)) { unbooked++; continue; }
        throw reject("unknown-status", { page, status: event.status, eventType: event.eventType });
      }
      if (INVESTMENT_TYPES.has(event.eventType)) { investmentEvents++; continue; }
      if (!CASH_TYPES.has(event.eventType)) throw reject("unsupported-event-type", { page, eventType: event.eventType, status: event.status ?? null }, "unsupported-event");
      if (event.amount.currency !== "EUR") throw reject("foreign-currency", { page, eventType: event.eventType, currency: event.amount.currency });
      if (Math.abs(event.amount.value) >= 1e10) throw reject("amount-out-of-range", { page, eventType: event.eventType });
      if (event.timestamp.slice(0, 10) > today) throw reject("future-date", { page, eventType: event.eventType, timestamp: maskPattern(event.timestamp) });
      movements.push({ id: event.id, date: event.timestamp.slice(0, 10), amount: event.amount.value.toFixed(2), description: event.title });
    }
    await onProgress?.(seen.size);
    const cursor = parsed.data.cursors?.after;
    if (!cursor) {
      tradeRepublicDebug("timeline.done", { pages: page + 1, events: seen.size, movements: movements.length, investmentEvents, unbooked });
      return { balance: cash.data[0].amount.toFixed(2), movements, investmentEvents };
    }
    if (cursors.has(cursor)) throw reject("repeated-cursor", { page });
    cursors.add(cursor); after = cursor;
  }
  throw reject("too-many-pages", { pages: MAX_PAGES });
}

/** Staging-only summary of one raw timeline page: categorical fields and formats, never titles, amounts or ids. */
function debugPage(page: number, raw: unknown): void {
  const items = raw && typeof raw === "object" && "items" in raw && Array.isArray(raw.items) ? raw.items as Record<string, unknown>[] : [];
  const field = (item: Record<string, unknown>, key: string) => typeof item?.[key] === "string" ? item[key] as string : String(item?.[key] ?? "missing");
  tradeRepublicDebug("timeline.page", {
    page,
    shape: describeShape(raw && typeof raw === "object" ? { ...raw, items: items.slice(0, 1) } : raw),
    items: items.length,
    eventTypes: countBy(items, item => field(item, "eventType")),
    statuses: countBy(items, item => field(item, "status")),
    timestampFormats: countBy(items, item => maskPattern(item?.timestamp)),
    amountCurrencies: countBy(items, item => { const amount = item?.amount as { currency?: unknown } | null | undefined; return amount ? String(amount.currency ?? "missing") : "none"; }),
    itemKeys: countBy(items, item => Object.keys(item ?? {}).sort().join(",")),
  });
}
