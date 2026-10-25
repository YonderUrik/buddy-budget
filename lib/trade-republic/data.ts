import { z } from "zod";
import { TradeRepublicError } from "./client";
import type { TradeRepublicReader } from "./socket";

const decimal = z.union([z.number(), z.string().regex(/^[+-]?\d+(?:\.\d+)?$/)]).transform(Number).pipe(z.number().finite());
const cashSchema = z.array(z.object({ currencyId: z.string(), amount: decimal }));
const eventSchema = z.object({
  id: z.string().min(1).max(200), timestamp: z.string().datetime({ offset: true }), eventType: z.string(),
  title: z.string().max(1000), amount: z.object({ value: decimal, currency: z.string() }).nullish(),
  status: z.string().optional(), cashAccountNumber: z.string().optional(),
});
const pageSchema = z.object({ items: z.array(eventSchema), cursors: z.object({ after: z.string().nullable().optional() }).optional() });
const MAX_PAGES = 200;
const MAX_FETCH_MS = 240_000;
const MAX_MOVEMENTS = 20_000;
const CASH_TYPES = new Set(["CARD_TRANSACTION", "CARD_REFUND", "CARD_PAYMENT", "CARD_PAYMENT_REFUND", "INTEREST_PAYOUT", "BANK_TRANSACTION_INCOMING", "BANK_TRANSACTION_OUTGOING", "BANK_TRANSACTION_OUTGOING_SEPA", "PAYMENT_INBOUND", "PAYMENT_OUTBOUND", "PAYMENT_INBOUND_GOOGLE_PAY", "INCOMING_TRANSFER", "OUTGOING_TRANSFER", "SSP_TAX_CORRECTION", "TAX_REFUND", "CASH_PAYOUT", "CASH_DEPOSIT", "SSP_CORPORATE_ACTION_CASH", "DIVIDEND", "DIVIDEND_PAYOUT"]);
const INVESTMENT_TYPES = new Set(["TRADING_SAVINGSPLAN_EXECUTED", "TRADING_TRADE_EXECUTED", "TRADE_INVOICE", "SAVINGS_PLAN_EXECUTED", "SAVEBACK_PAYOUT", "SSP_CORPORATE_ACTION_SECURITIES"]);

export interface TradeRepublicMovement { id: string; date: string; amount: string; description: string }
export interface TradeRepublicCashData { balance: string; movements: TradeRepublicMovement[]; investmentEvents: number }

/** Fetch complete booked cash history. Unknown monetary events block the import instead of disappearing. */
export async function readTradeRepublicCash(reader: TradeRepublicReader, today: string, onProgress?: (count: number) => Promise<void>): Promise<TradeRepublicCashData> {
  const startedAt = Date.now();
  const cash = cashSchema.safeParse(await reader.read("cash"));
  if (!cash.success || cash.data.length !== 1 || cash.data[0].currencyId !== "EUR" || Math.abs(cash.data[0].amount) >= 1e10) throw new TradeRepublicError("invalid-response");
  const movements: TradeRepublicMovement[] = [];
  const seen = new Map<string, string>();
  const cursors = new Set<string>();
  let after: string | undefined;
  let investmentEvents = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    if (Date.now() - startedAt > MAX_FETCH_MS) throw new TradeRepublicError("unavailable");
    const parsed = pageSchema.safeParse(await reader.read("timelineTransactions", after));
    if (!parsed.success) throw new TradeRepublicError("invalid-response");
    for (const event of parsed.data.items) {
      const fingerprint = JSON.stringify(event);
      if (seen.has(event.id)) {
        if (seen.get(event.id) !== fingerprint) throw new TradeRepublicError("invalid-response");
        continue;
      }
      seen.set(event.id, fingerprint);
      if (seen.size > MAX_MOVEMENTS) throw new TradeRepublicError("invalid-response");
      if (!event.amount) continue;
      if (event.status && event.status !== "COMPLETED" && event.status !== "EXECUTED" && event.status !== "SETTLED") throw new TradeRepublicError("invalid-response");
      if (INVESTMENT_TYPES.has(event.eventType)) { investmentEvents++; continue; }
      if (!CASH_TYPES.has(event.eventType)) throw new TradeRepublicError("unsupported-event");
      if (event.amount.currency !== "EUR" || Math.abs(event.amount.value) >= 1e10 || event.timestamp.slice(0, 10) > today) throw new TradeRepublicError("invalid-response");
      movements.push({ id: event.id, date: event.timestamp.slice(0, 10), amount: event.amount.value.toFixed(2), description: event.title });
    }
    await onProgress?.(seen.size);
    const cursor = parsed.data.cursors?.after;
    if (!cursor) return { balance: cash.data[0].amount.toFixed(2), movements, investmentEvents };
    if (cursors.has(cursor)) throw new TradeRepublicError("invalid-response");
    cursors.add(cursor); after = cursor;
  }
  throw new TradeRepublicError("invalid-response");
}
