import { NextRequest } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { userInstrumentPrices } from "@/lib/db/schema/investments";
import { findVisibleInstrument } from "@/lib/investments/instruments";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { manualPriceSchema } from "@/lib/validation/investments";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Inserisce o sostituisce il prezzo manuale dell'utente per lo strumento in una data: vale solo per lui. */
async function handlePost(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const { id } = await params;
  if (!(await findVisibleInstrument(session.user.id, id))) {
    return Response.json({ error: "Strumento non trovato" }, { status: 404 });
  }
  const parsed = manualPriceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  if (parsed.data.date > todayKey()) return Response.json({ error: "La data non può essere nel futuro" }, { status: 400 });

  const [saved] = await db
    .insert(userInstrumentPrices)
    .values({ userId: session.user.id, instrumentId: id, date: parsed.data.date, close: String(parsed.data.close) })
    .onConflictDoUpdate({
      target: [userInstrumentPrices.userId, userInstrumentPrices.instrumentId, userInstrumentPrices.date],
      set: { close: sql`excluded.close`, updatedAt: new Date() },
    })
    .returning();
  return Response.json(saved, { status: 201 });
}

/** Cancella il prezzo manuale dell'utente in una data (`?date=YYYY-MM-DD`). */
async function handleDelete(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const { id } = await params;
  const date = request.nextUrl.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "Data non valida" }, { status: 400 });
  const deleted = await db
    .delete(userInstrumentPrices)
    .where(
      and(
        eq(userInstrumentPrices.userId, session.user.id),
        eq(userInstrumentPrices.instrumentId, id),
        eq(userInstrumentPrices.date, date)
      )
    )
    .returning({ id: userInstrumentPrices.id });
  return deleted.length > 0 ? new Response(null, { status: 204 }) : Response.json({ error: "Prezzo non trovato" }, { status: 404 });
}

export const POST = withRoute("instruments.manual_price_upsert", handlePost);
export const DELETE = withRoute("instruments.manual_price_delete", handleDelete);
