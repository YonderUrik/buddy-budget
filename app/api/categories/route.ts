import { NextRequest } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { createCategorySchema } from "@/lib/validation/categories";
import { bindRequestUser, withRoute } from "@/lib/observability";

/** GET /api/categories — ritorna le categorie dell'utente autenticato, ordinate per data di creazione. */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

  const userCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, session.user.id))
    .orderBy(asc(categories.createdAt));

  return Response.json(userCategories);
}

/** POST /api/categories — crea una categoria per l'utente autenticato; 409 se il nome è già in uso. */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

  const body = await request.json();
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, session.user.id), eq(categories.name, parsed.data.name)));
  if (existing) {
    return Response.json({ error: "Categoria già esistente" }, { status: 409 });
  }

  const [category] = await db
    .insert(categories)
    .values({
      userId: session.user.id,
      name: parsed.data.name,
      type: parsed.data.type,
      ...(parsed.data.color ? { color: parsed.data.color } : {}),
      ...(parsed.data.icon ? { icon: parsed.data.icon } : {}),
    })
    .returning();

  return Response.json(category, { status: 201 });
}

export const GET = withRoute("categories.list", handleGet);
export const POST = withRoute("categories.create", handlePost);
