import { NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";

/** GET /api/categories — ritorna le categorie dell'utente autenticato, ordinate per data di creazione. */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const userCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, session.user.id))
    .orderBy(asc(categories.createdAt));

  return Response.json(userCategories);
}
