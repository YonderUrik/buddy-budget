import { NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { createAccountSchema } from "@/lib/validation/accounts";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const userAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, session.user.id))
    .orderBy(asc(accounts.createdAt));

  return Response.json(userAccounts);
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

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
      institution: parsed.data.institution ?? null,
      type: parsed.data.type,
      balance: parsed.data.balance.toFixed(2),
      source: "manuale",
    })
    .returning();

  return Response.json(account, { status: 201 });
}
