import "server-only";
import { and, eq, gte, lt, notInArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { subscriptions } from "@/lib/db/schema/subscriptions";
import { transactions } from "@/lib/db/schema/transactions";
import { SUBSCRIPTION_LOOKBACK_MONTHS, addMonthsIso, detectSubscriptions } from "@/lib/calc/subscriptions";
import { recordSubscriptionsDetect, requestLogger } from "@/lib/observability";
import type { CategoryType } from "@/lib/categories/groups";
import { withMerchantLogos } from "@/lib/categorization/merchant-logo/attach";
import { buildSubscriptionsView, type StoredSubscriptionRow, type SubscriptionsView } from "./view";

/** Gruppi di categorie le cui uscite non entrano mai nel rilevamento. */
const EXCLUDED_CATEGORY_TYPES: CategoryType[] = ["futuro", "entrata", "trasferimento"];

export type SubscriptionsResponse = SubscriptionsView & { currency: string; today: string };

/** Righe salvate dell'utente nella forma che usa la vista (importi come numeri). */
export async function loadStoredSubscriptions(userId: string): Promise<StoredSubscriptionRow[]> {
  const rows = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    status: row.status,
    origin: row.origin,
    name: row.name,
    amount: row.amount === null ? null : Number(row.amount),
    cadence: row.cadence,
    nextDate: row.nextDate,
    categoryId: row.categoryId,
  }));
}

/**
 * Detection + saved choices for the user, without logos: reads the spending of the last 26 months and builds the view.
 * Also used by the «Dall'ultima visita» summary, which only needs counts.
 */
export async function loadSubscriptionsView(
  userId: string,
  now: Date = new Date()
): Promise<{ view: SubscriptionsView; currency: string; today: string; descriptions: Map<string, string> }> {
  const started = performance.now();
  const today = now.toISOString().slice(0, 10);
  const since = addMonthsIso(today, -SUBSCRIPTION_LOOKBACK_MONTHS);
  const [[user], spending, stored] = await Promise.all([
    db.select({ currency: authUser.currency }).from(authUser).where(eq(authUser.id, userId)),
    db
      .select({ id: transactions.id, date: transactions.date, amount: transactions.amount, description: transactions.description, categoryId: transactions.categoryId })
      .from(transactions)
      .innerJoin(categories, eq(categories.id, transactions.categoryId))
      // Risparmio e investimenti (gruppo «Te futuro») tornano ogni mese ma non sono abbonamenti.
      .where(and(eq(transactions.userId, userId), lt(transactions.amount, "0"), gte(transactions.date, since), notInArray(categories.type, EXCLUDED_CATEGORY_TYPES))),
    loadStoredSubscriptions(userId),
  ]);
  const detected = detectSubscriptions(
    spending.map((tx) => ({ ...tx, amount: Math.abs(Number(tx.amount)) })),
    today
  );
  const view = buildSubscriptionsView(detected, stored, today);
  const durationMs = performance.now() - started;
  recordSubscriptionsDetect(durationMs);
  requestLogger().info("subscriptions.detect.completed", {
    durationMs: Math.round(durationMs),
    detected: detected.length,
    confirmed: view.totals.count,
    pending: view.totals.pendingCount,
    stopped: view.items.filter((i) => i.activity === "fermo").length,
  });
  return { view, currency: user?.currency ?? "EUR", today, descriptions: new Map(spending.map((tx) => [tx.id, tx.description])) };
}

/** Rilevamento + scelte salvate per l'utente, con i loghi (schermata Abbonamenti). */
export async function loadSubscriptions(userId: string, now: Date = new Date()): Promise<SubscriptionsResponse> {
  const { view, currency, today, descriptions } = await loadSubscriptionsView(userId, now);
  const items = await withMerchantLogos(
    view.items,
    (item) => ({ label: item.name, texts: item.charges.map((charge) => descriptions.get(charge.id)), isExpense: true }),
    userId
  );
  return { ...view, items, currency, today };
}
