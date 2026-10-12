import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { readJson, sessionOrUnauthorized } from "@/lib/account/route-session";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { requestLogger, withRoute } from "@/lib/observability";

const bodySchema = z.object({
  /** Fin dove l'utente ha controllato (il `lastCategorizedAt` più recente che vedeva): ciò che arriva dopo resta da vedere. */
  until: z.iso.datetime({ offset: true }),
  /** Quanti movimenti erano nella lista (solo per il log). */
  count: z.number().int().min(0).max(100_000).optional(),
});

/**
 * POST /api/transactions/auto-categorized/seen — «Va tutto bene»: le categorie applicate da sole fino a `until` escono
 * da «Messe dall'app». Restano com'erano su ogni movimento (e in Movimenti si vede ancora da dove vengono).
 */
async function handlePost(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: "Dati non validi" }, { status: 400 });

  const now = new Date();
  const until = new Date(parsed.data.until);
  await db
    .update(authUser)
    .set({ autoCategorizedSeenAt: until > now ? now : until })
    .where(eq(authUser.id, session.user.id));
  requestLogger().info("categorization.auto.reviewed", { count: parsed.data.count ?? 0 });
  return Response.json({ ok: true });
}

export const POST = withRoute("transactions.auto_categorized_seen", handlePost);
