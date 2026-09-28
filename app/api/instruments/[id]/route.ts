import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { instruments } from "@/lib/db/schema/investments";
import { findVisibleInstrument } from "@/lib/investments/instruments";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { updateInstrumentSchema } from "@/lib/validation/investments";

/**
 * Rinomina uno strumento. Solo gli strumenti manuali, creati dall'utente stesso: quelli comuni sono condivisi e
 * un nome cambiato da un utente cambierebbe anche per gli altri.
 */
async function handlePatch(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const { id } = await params;
  const instrument = await findVisibleInstrument(session.user.id, id);
  if (!instrument) return Response.json({ error: "Strumento non trovato" }, { status: 404 });
  if (instrument.createdByUserId !== session.user.id) {
    return Response.json({ error: "Solo gli strumenti manuali si possono rinominare" }, { status: 403 });
  }

  const parsed = updateInstrumentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const [updated] = await db
    .update(instruments)
    .set({ name: parsed.data.name, updatedAt: new Date() })
    .where(and(eq(instruments.id, id), eq(instruments.createdByUserId, session.user.id)))
    .returning();
  return Response.json(updated);
}

export const PATCH = withRoute("instruments.update", handlePatch);
