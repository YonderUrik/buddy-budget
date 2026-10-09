import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { bankConnections } from "@/lib/db/schema/bank-connections";
import { loadUserDebts } from "@/lib/debts/data";
import { todayIso } from "@/lib/debts/dates";
import { buildDebtsView } from "@/lib/debts/view";
import { buildSidebarDeadlines } from "./deadlines-build";
import type { SidebarDeadlines } from "./types";

/** Prossime scadenze dell'utente: rate dei finanziamenti e collegamenti bancari da rinnovare. Query leggere, nessun prezzo. */
export async function loadSidebarDeadlines(userId: string): Promise<SidebarDeadlines> {
  const now = new Date();
  const [[user], { debts, events }, connections] = await Promise.all([
    db.select({ currency: authUser.currency }).from(authUser).where(eq(authUser.id, userId)),
    loadUserDebts(userId),
    db
      .select({
        id: bankConnections.id,
        institutionName: bankConnections.institutionName,
        status: bankConnections.status,
        consentExpiresAt: bankConnections.consentExpiresAt,
      })
      .from(bankConnections)
      .where(and(eq(bankConnections.userId, userId), isNull(bankConnections.orphanedAt))),
  ]);
  const debtDue = buildDebtsView(debts, events, todayIso(now)).overview.nextDue;
  return { currency: user?.currency ?? "EUR", items: buildSidebarDeadlines({ debtDue, connections, now }) };
}
