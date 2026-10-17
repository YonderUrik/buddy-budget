import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { transactions } from "@/lib/db/schema/transactions";
import { DEFAULT_CATEGORIES, OPTIONAL_DEFAULT_CATEGORIES } from "@/lib/categories/defaults";
import { LANGUAGES, type Language } from "@/lib/localization/config";
import { translate } from "@/lib/localization/messages";
import { hasDemoData } from "./status";
import { buildDemoData, translateDemoText } from "./demo-data";

/** Codice di errore delle azioni bloccate mentre i dati d'esempio sono attivi. */
export const DEMO_ACTIVE_CODE = "demo_active";
const INSERT_CHUNK = 200;

export type StartDemoResult = { ok: true; accounts: number; transactions: number } | { ok: false; reason: "has_data" | "already_active" | "no_categories" };

const CATEGORY_DEFAULTS = [...DEFAULT_CATEGORIES, ...OPTIONAL_DEFAULT_CATEGORIES];

/**
 * Default-category key → category id. Uses the stored `defaultKey`, and for older rows without it a default name in
 * any supported language, so the demo finds its categories whatever language they were created in.
 */
function categoryIdsByKey(rows: { id: string; name: string; defaultKey: string | null }[]): Map<string, string> {
  const ids = new Map<string, string>();
  for (const row of rows) {
    const key = row.defaultKey ?? CATEGORY_DEFAULTS.find((c) => LANGUAGES.some((language) => translate(language, c.name) === row.name))?.key;
    if (key && !ids.has(key)) ids.set(key, row.id);
  }
  return ids;
}

/**
 * Creates the example data only for users with nothing yet (no account), so it never mixes with real data:
 * `isDemo` accounts, transactions linked to them and the rebuilt cash history. Names and descriptions are written in
 * the user's interface language. Returns the number of transactions actually inserted.
 */
export async function startDemo(userId: string, today: Date = new Date(), language: Language = "it"): Promise<StartDemoResult> {
  if (await hasDemoData(userId)) return { ok: false, reason: "already_active" };
  const existing = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.userId, userId)).limit(1);
  if (existing.length) return { ok: false, reason: "has_data" };
  const cats = await db.select({ id: categories.id, name: categories.name, defaultKey: categories.defaultKey }).from(categories).where(eq(categories.userId, userId));
  if (!cats.length) return { ok: false, reason: "no_categories" };
  const categoryId = categoryIdsByKey(cats);
  const data = buildDemoData(today, language);

  const inserted = await db.transaction(async (tx) => {
    const [checking] = await tx
      .insert(accounts)
      .values(
        [data.checking, data.savings].map((a) => ({
          userId,
          name: a.name,
          type: a.type,
          color: a.color,
          icon: a.icon,
          balance: a.balance.toFixed(2),
          source: "manuale" as const,
          isDemo: true,
        }))
      )
      .returning({ id: accounts.id });
    const rows = data.transactions.flatMap((t) => {
      const id = categoryId.get(t.category);
      if (!id) return [];
      return [{ userId, accountId: checking.id, categoryId: id, description: t.description, amount: t.amount.toFixed(2), date: t.date, source: "manuale" as const }];
    });
    for (let i = 0; i < rows.length; i += INSERT_CHUNK) await tx.insert(transactions).values(rows.slice(i, i + INSERT_CHUNK));
    for (let i = 0; i < data.liquidityHistory.length; i += INSERT_CHUNK) {
      await tx
        .insert(netWorthSnapshots)
        .values(data.liquidityHistory.slice(i, i + INSERT_CHUNK).map((p) => ({ userId, date: p.date, assetClass: "liquidita" as const, amount: p.amount.toFixed(2), source: "derivato" as const })))
        .onConflictDoNothing();
    }
    return rows.length;
  });
  return { ok: true, accounts: 2, transactions: inserted };
}

/**
 * Rewrites the demo account names and transaction descriptions into `language` (called when the user changes the
 * interface language). Only texts the demo wrote are changed: a name or description the user edited stays as it is.
 * Returns how many rows changed.
 */
export async function localizeDemo(userId: string, language: Language): Promise<number> {
  return db.transaction(async (tx) => {
    const demo = await tx.select({ id: accounts.id, name: accounts.name }).from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.isDemo, true)));
    if (!demo.length) return 0;
    let changed = 0;
    for (const account of demo) {
      const name = translateDemoText(account.name, language);
      if (name === null || name === account.name) continue;
      await tx.update(accounts).set({ name }).where(eq(accounts.id, account.id));
      changed++;
    }
    const rows = await tx
      .select({ id: transactions.id, description: transactions.description })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), inArray(transactions.accountId, demo.map((a) => a.id))));
    for (const row of rows) {
      const description = translateDemoText(row.description, language);
      if (description === null || description === row.description) continue;
      await tx.update(transactions).set({ description }).where(eq(transactions.id, row.id));
      changed++;
    }
    return changed;
  });
}

/**
 * Azzera i dati d'esempio: toglie i conti demo, i loro movimenti e lo storico di liquidità (che, finché la demo è
 * attiva, viene solo dai conti demo perché non si possono aggiungere conti veri). Ritorna i conti rimossi.
 */
export async function clearDemo(userId: string): Promise<number> {
  return db.transaction(async (tx) => {
    const demo = await tx.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.isDemo, true)));
    if (!demo.length) return 0;
    const ids = demo.map((a) => a.id);
    await tx.delete(transactions).where(and(eq(transactions.userId, userId), inArray(transactions.accountId, ids)));
    await tx.delete(accounts).where(inArray(accounts.id, ids));
    await tx.delete(netWorthSnapshots).where(and(eq(netWorthSnapshots.userId, userId), eq(netWorthSnapshots.assetClass, "liquidita")));
    return ids.length;
  });
}

/** 409 response, in the user's language, for an action that would create real data while the demo is active; null otherwise. */
export async function rejectIfDemoActive(userId: string, language: Language = "it"): Promise<Response | null> {
  if (!(await hasDemoData(userId))) return null;
  return Response.json(
    { error: translate(language, "Stai esplorando i dati d'esempio: azzerali per aggiungere i tuoi."), code: DEMO_ACTIVE_CODE },
    { status: 409 }
  );
}
