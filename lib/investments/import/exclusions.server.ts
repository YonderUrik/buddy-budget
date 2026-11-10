import "server-only";
import { and, eq, gte, inArray } from "drizzle-orm";
import type { db } from "@/lib/db/client";
import { brokerOperationExclusions } from "@/lib/db/schema/broker-operation-exclusions";
import type { InvestmentTransaction } from "@/lib/db/schema/investments";
import type { ExcludedOperation } from "./exclusions";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The user's deletions for one broker source, in the shape `applyExclusions` matches. */
export async function loadExclusions(tx: Tx, userId: string, accountKey: string): Promise<ExcludedOperation[]> {
  const rows = await tx.select().from(brokerOperationExclusions).where(and(eq(brokerOperationExclusions.userId, userId), eq(brokerOperationExclusions.accountKey, accountKey)));
  return rows.map((r) => ({ id: r.id, instrumentId: r.instrumentId, type: r.type, date: r.date, quantity: r.quantity, price: r.price, grossAmount: r.grossAmount }));
}

/** Remembers that the user deleted this imported operation, so the next import of its source leaves it out. */
export async function recordExclusion(tx: Tx, userId: string, accountKey: string, op: InvestmentTransaction): Promise<void> {
  await tx.insert(brokerOperationExclusions).values({ userId, accountKey, instrumentId: op.instrumentId, type: op.type, date: op.date, quantity: op.quantity, price: op.price, grossAmount: op.grossAmount });
}

/** Forgets the deletions of some sources (all of them, or from a date on), when their history goes away with them. */
export async function clearExclusions(tx: Tx, userId: string, accountKeys: string[] | "all", from?: string): Promise<void> {
  if (accountKeys !== "all" && !accountKeys.length) return;
  await tx.delete(brokerOperationExclusions).where(and(
    eq(brokerOperationExclusions.userId, userId),
    accountKeys === "all" ? undefined : inArray(brokerOperationExclusions.accountKey, accountKeys),
    from ? gte(brokerOperationExclusions.date, from) : undefined,
  ));
}
