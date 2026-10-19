import { resolveProfile } from "@/lib/localization/config";
import { NextRequest } from "next/server";
import { startOfDay } from "@/lib/calc/expenses";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { createAccountSchema } from "@/lib/validation/accounts";
import { rejectIfDemoActive } from "@/lib/start/demo";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { apiError, validationError } from "@/lib/http";
import { loadAccountsWithExtras, loadUserAccounts } from "@/lib/views/server";
import { parseAccountIncludes, parseTodayParam } from "@/lib/views";

/**
 * GET /api/accounts — the user's accounts, oldest first. With `include=trend,health` (native apps, gaps.md G5) each
 * account also has `bankName`, `trend` (30-day balance, linked accounts), `health` (connection) and a localized
 * `status`; `today=YYYY-MM-DD` sets the client's day for the trend.
 */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

  // Each account carries `followsTransactions` (linked banks and file imports move their balance with their transactions).
  const userAccounts = await loadUserAccounts(session.user.id);
  const include = parseAccountIncludes(new URL(request.url).searchParams.get("include"));
  if (include === null) {
    return apiError(400, "validation_failed", "include accetta solo trend e health", { field: "include" });
  }
  if (include.size === 0) return Response.json(userAccounts);
  const today = parseTodayParam(request);
  if (today === null) return apiError(400, "invalid_date", "today deve avere formato YYYY-MM-DD", { field: "today" });
  // Native apps (gaps.md G5): each account also carries its bank, 30-day trend, connection health and status line.
  return Response.json(await loadAccountsWithExtras(session.user, userAccounts, { today: today ?? startOfDay(new Date()) }));
}

async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);
  const demoBlock = await rejectIfDemoActive(session.user.id, resolveProfile(session.user).language);
  if (demoBlock) return demoBlock;

  const body = await request.json();
  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const [account] = await db
    .insert(accounts)
    .values({
      userId: session.user.id,
      name: parsed.data.name,
      type: parsed.data.type,
      balance: parsed.data.balance.toFixed(2),
      source: "manuale",
      ...(parsed.data.color ? { color: parsed.data.color } : {}),
      ...(parsed.data.icon ? { icon: parsed.data.icon } : {}),
    })
    .returning();

  return Response.json(account, { status: 201 });
}

export const GET = withRoute("accounts.list", handleGet);
export const POST = withRoute("accounts.create", handlePost);
