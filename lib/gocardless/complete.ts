import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { bankConnections } from "@/lib/db/schema/bank-connections";
import { getAccountDetails, getRequisition, type AccountDetails } from "./client";
import { consentExpiryFrom } from "./connection-health";

/** GoCardless requisition statuses that mean "the user is still in the consent flow" (not an outcome yet). */
export const IN_PROGRESS_REQUISITION_STATUSES = ["CR", "GC", "UA", "SA", "GA"] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The user's connection by id; null when not found, not theirs or the id is not a uuid (Postgres would throw). */
export async function findUserConnection(userId: string, connectionId: string) {
  if (!UUID.test(connectionId)) return null;
  const [connection] = await db
    .select()
    .from(bankConnections)
    .where(and(eq(bankConnections.id, connectionId), eq(bankConnections.userId, userId)));
  return connection ?? null;
}

/** The consent counts from when the user gives it (not from when the requisition was created): the countdown starts here. */
export async function markConsentGranted(connectionId: string, now: Date = new Date()): Promise<Date> {
  const consentExpiresAt = consentExpiryFrom(now);
  await db.update(bankConnections).set({ status: "linked", consentExpiresAt, updatedAt: now }).where(eq(bankConnections.id, connectionId));
  return consentExpiresAt;
}

export interface ConnectionAccounts {
  externalAccounts: { externalAccountId: string; details: AccountDetails }[];
  existingAutoAccounts: { id: string; name: string }[];
}

/**
 * What the «Conti trovati» selection shows: the accounts the bank shared (one details call each, GoCardless rate
 * limits apply) and the user's linked accounts a new one can replace (renewal). Throws `GoCardlessError`.
 */
export async function loadConnectionAccounts(userId: string, externalAccountIds: string[]): Promise<ConnectionAccounts> {
  const externalAccounts = await Promise.all(
    externalAccountIds.map(async (externalAccountId) => ({ externalAccountId, details: await getAccountDetails(externalAccountId) }))
  );
  const existingAutoAccounts = await db
    .select({ id: accounts.id, name: accounts.name })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.source, "auto")));
  return { externalAccounts, existingAutoAccounts };
}

export type CompleteConnectionResult =
  | { kind: "not_found" }
  | { kind: "pending"; requisitionStatus: string }
  | { kind: "failed"; requisitionStatus: string }
  | {
      kind: "linked";
      connection: { id: string; institutionId: string; institutionName: string; consentExpiresAt: Date | null };
      accounts: ConnectionAccounts;
    };

/**
 * Finalizes the consent step of a bank connection from an authenticated client (the native apps, after the browser
 * hands back `buddybudget://bank/return`): asks GoCardless for the requisition and
 * - LN (linked) → marks the connection `linked` (once: a repeated call keeps the original consent expiry) and returns
 *   the accounts to select, like `GET /connections/{id}/accounts`;
 * - still in the consent flow (CR, GC, UA, SA, GA) → `pending`, nothing changes (the user closed the browser early);
 * - anything else (RJ rejected, EX expired, SU suspended…) → marks the connection `error`.
 * Throws `GoCardlessError` when GoCardless cannot be reached.
 */
export async function completeConnection(userId: string, connectionId: string, now: Date = new Date()): Promise<CompleteConnectionResult> {
  const connection = await findUserConnection(userId, connectionId);
  if (!connection || !connection.requisitionId) return { kind: "not_found" };

  const requisition = await getRequisition(connection.requisitionId);
  if (requisition.status !== "LN") {
    if ((IN_PROGRESS_REQUISITION_STATUSES as readonly string[]).includes(requisition.status)) {
      return { kind: "pending", requisitionStatus: requisition.status };
    }
    // An already linked connection is never downgraded here (its accounts keep syncing until the consent expires).
    await db
      .update(bankConnections)
      .set({ status: "error", updatedAt: now })
      .where(and(eq(bankConnections.id, connection.id), inArray(bankConnections.status, ["pending", "error"])));
    return { kind: "failed", requisitionStatus: requisition.status };
  }

  const consentExpiresAt = connection.status === "linked" ? connection.consentExpiresAt : await markConsentGranted(connection.id, now);
  return {
    kind: "linked",
    connection: { id: connection.id, institutionId: connection.institutionId, institutionName: connection.institutionName, consentExpiresAt },
    accounts: await loadConnectionAccounts(userId, requisition.accounts),
  };
}
