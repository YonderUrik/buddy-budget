import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authAccount, authSession, authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { defaultCategoryRows } from "@/lib/categories/seed";
import { isLocalMode, LOCAL_OWNER_EMAIL, LOCAL_OWNER_ID } from "@/lib/selfhost";

const MARKER_ID = "buddybudget-local-mode";

/** Create one local owner atomically; switching to server mode preserves data and revokes automatic sessions. */
export async function initializeLocalOwner(): Promise<void> {
  if (process.env.SELF_HOSTED !== "true") return;
  const local = isLocalMode();
  await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(1873462001)`);
    const users = await tx.select({ id: authUser.id, email: authUser.email }).from(authUser);
    let owner = users.find(user => user.id === LOCAL_OWNER_ID);
    if (local && users.some(user => user.id !== LOCAL_OWNER_ID)) throw new Error("Local mode requires a fresh database or an existing local owner. Keep server mode for a database with other accounts.");
    if (!local && !owner) return;
    const email = (process.env.SELFHOST_OWNER_EMAIL?.trim() || owner?.email || LOCAL_OWNER_EMAIL).toLowerCase();
    if (!local && email === LOCAL_OWNER_EMAIL) throw new Error("Set the local owner's real email in setup before switching to server mode.");
    if (users.some(user => user.id !== LOCAL_OWNER_ID && user.email === email)) throw new Error("The owner's email is already used by another account. Accounts will not be merged.");
    if (!owner) {
      [owner] = await tx.insert(authUser).values({ id: LOCAL_OWNER_ID, email, name: "My budget", language: "en", emailVerified: false }).returning({ id: authUser.id, email: authUser.email });
      await tx.insert(categories).values(defaultCategoryRows(LOCAL_OWNER_ID));
    }
    const [marker] = await tx.select().from(authAccount).where(eq(authAccount.id, MARKER_ID));
    const mode = local ? "local" : "server";
    if (owner.email !== email || marker?.accountId !== mode) {
      await tx.delete(authSession).where(eq(authSession.userId, LOCAL_OWNER_ID));
      await tx.update(authUser).set({ email, emailVerified: false, updatedAt: new Date() }).where(eq(authUser.id, LOCAL_OWNER_ID));
    }
    await tx.insert(authAccount).values({ id: MARKER_ID, userId: LOCAL_OWNER_ID, providerId: "selfhost-mode", accountId: mode }).onConflictDoUpdate({ target: authAccount.id, set: { accountId: mode, updatedAt: new Date() } });
  });
}
