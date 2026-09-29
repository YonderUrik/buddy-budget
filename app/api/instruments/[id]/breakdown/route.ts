import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { userInstrumentBreakdowns } from "@/lib/db/schema/investments";
import { findVisibleInstrument } from "@/lib/investments/instruments";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { updateBreakdownSchema } from "@/lib/validation/investments";

/**
 * Correzione manuale di settore e area di uno strumento, solo per l'utente che la fa. `null` in una dimensione
 * torna all'automatico; entrambe null cancellano la correzione.
 */
async function handlePut(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const userId = session.user.id;

  const { id } = await params;
  const instrument = await findVisibleInstrument(userId, id);
  if (!instrument) return Response.json({ error: "Strumento non trovato" }, { status: 404 });

  const parsed = updateBreakdownSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { sectors, areas } = parsed.data;

  const where = and(eq(userInstrumentBreakdowns.userId, userId), eq(userInstrumentBreakdowns.instrumentId, id));
  if (sectors === null && areas === null) {
    await db.delete(userInstrumentBreakdowns).where(where);
    return Response.json({ instrumentId: id, sectors: null, areas: null });
  }
  const values = { sectors: sectors as Record<string, number> | null, areas: areas as Record<string, number> | null, updatedAt: new Date() };
  const [saved] = await db
    .insert(userInstrumentBreakdowns)
    .values({ userId, instrumentId: id, ...values })
    .onConflictDoUpdate({ target: [userInstrumentBreakdowns.userId, userInstrumentBreakdowns.instrumentId], set: values })
    .returning({ instrumentId: userInstrumentBreakdowns.instrumentId, sectors: userInstrumentBreakdowns.sectors, areas: userInstrumentBreakdowns.areas });
  return Response.json(saved);
}

export const PUT = withRoute("instruments.breakdown_update", handlePut);
