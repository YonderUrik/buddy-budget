import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { createCategorySchema } from "@/lib/validation/categories";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { apiError, validationError } from "@/lib/http";
import { resolveProfile } from "@/lib/localization/config";
import { loadUserCategories } from "@/lib/views/server";

/** GET /api/categories — the user's categories, oldest first, default names and descriptions in the user's language. */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

  // Default categories in the user's language (G11); the web localizes again on the client, which is idempotent.
  return Response.json(await loadUserCategories(session.user.id, resolveProfile(session.user)));
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
    return validationError(parsed.error);
  }

  const [existing] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, session.user.id), eq(categories.name, parsed.data.name)));
  if (existing) {
    return apiError(409, "category_exists", "Categoria già esistente");
  }

  const [category] = await db
    .insert(categories)
    .values({
      userId: session.user.id,
      name: parsed.data.name,
      type: parsed.data.type,
      ...(parsed.data.color ? { color: parsed.data.color } : {}),
      ...(parsed.data.icon ? { icon: parsed.data.icon } : {}),
      ...(parsed.data.description ? { description: parsed.data.description } : {}),
    })
    .returning();

  return Response.json(category, { status: 201 });
}

export const GET = withRoute("categories.list", handleGet);
export const POST = withRoute("categories.create", handlePost);
