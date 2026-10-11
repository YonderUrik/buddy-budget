import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { transactions } from "@/lib/db/schema/transactions";
import { hasDemoData } from "./status";
import { buildDemoData } from "./demo-data";

/** Codice di errore delle azioni bloccate mentre i dati d'esempio sono attivi. */
export const DEMO_ACTIVE_CODE = "demo_active";
const INSERT_CHUNK = 200;

export type StartDemoResult = { ok: true; accounts: number; transactions: number } | { ok: false; reason: "has_data" | "already_active" | "no_categories" };

/**
 * Crea i dati d'esempio solo per chi non ha ancora nulla (nessun conto): così non si mescolano mai con dati veri.
 * Conti con `isDemo`, movimenti collegati a quei conti e storico della liquidità ricostruito.
 */
export async function startDemo(userId: string, today: Date = new Date()): Promise<StartDemoResult> {
  if (await hasDemoData(userId)) return { ok: false, reason: "already_active" };
  const existing = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.userId, userId)).limit(1);
  if (existing.length) return { ok: false, reason: "has_data" };
  const cats = await db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.userId, userId));
  if (!cats.length) return { ok: false, reason: "no_categories" };
  const categoryId = new Map(cats.map((c) => [c.name, c.id]));
  const data = buildDemoData(today);

  await db.transaction(async (tx) => {
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
  });
  return { ok: true, accounts: 2, transactions: data.transactions.length };
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

/** Risposta 409 per un'azione che creerebbe dati veri mentre ci sono quelli d'esempio, oppure null se si può procedere. */
export async function rejectIfDemoActive(userId: string): Promise<Response | null> {
  if (!(await hasDemoData(userId))) return null;
  return Response.json(
    { error: "Stai esplorando i dati d'esempio: azzerali per aggiungere i tuoi.", code: DEMO_ACTIVE_CODE },
    { status: 409 }
  );
}
