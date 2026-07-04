import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const body = await request.json();
  const { currency } = body as { currency?: string };

  if (!currency || typeof currency !== "string" || currency.trim() === "") {
    return Response.json({ error: "currency è richiesta" }, { status: 400 });
  }

  await db
    .update(authUser)
    .set({ currency: currency.trim(), onboardingCompleted: true })
    .where(eq(authUser.id, session.user.id));

  return new Response(null, { status: 200 });
}
