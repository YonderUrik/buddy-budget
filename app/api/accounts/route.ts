import { NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { createAccountSchema } from "@/lib/validation/accounts";
import { rejectIfDemoActive } from "@/lib/start/demo";
import { bindRequestUser, withRoute } from "@/lib/observability";

async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

  const userAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, session.user.id))
    .orderBy(asc(accounts.createdAt));

  return Response.json(userAccounts);
}

async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);
  const demoBlock = await rejectIfDemoActive(session.user.id);
  if (demoBlock) return demoBlock;

  const body = await request.json();
  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
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
