import "server-only";

import { notLike } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { authMethods } from "@/lib/instance/config";
import { PUBLIC_DEMO_USER_PREFIX } from "@/lib/public-demo/config";

/** Error code better-auth returns when a new account is refused because signups are closed. */
export const SIGNUPS_CLOSED_CODE = "SIGNUPS_CLOSED";

/** True once the instance has at least one real account (the read-only public demo accounts do not count). */
export async function hasAccounts(): Promise<boolean> {
  const [row] = await db
    .select({ id: authUser.id })
    .from(authUser)
    .where(notLike(authUser.id, `${PUBLIC_DEMO_USER_PREFIX}%`))
    .limit(1);
  return row !== undefined;
}

/** A new account can be created: signups are open, or this is the very first account of the instance. */
export async function canCreateAccount(): Promise<boolean> {
  return authMethods().openSignup || !(await hasAccounts());
}
