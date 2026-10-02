import { NextRequest } from "next/server";
import { count, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { pensionSnapshots } from "@/lib/db/schema/pension";
import { todayIso } from "@/lib/debts/dates";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";
import { findOwnPensionFund } from "@/lib/pension/data";
import { PENSION_MAX_SNAPSHOTS_PER_FUND } from "@/lib/pension/limits";
import { createPensionSnapshotSchema, isPlausiblePensionDate } from "@/lib/validation/pension";

type Params = { params: Promise<{ id: string }> };

/** Registra la fotografia di un fondo (contributi netti e controvalore in una data); se esiste già quella data la sostituisce. */
async function handlePost(request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const userId = session.user.id;

  const parsed = createPensionSnapshotSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const input = parsed.data;
  if (!isPlausiblePensionDate(input.date, todayIso())) return Response.json({ error: "Data non valida" }, { status: 400 });

  const { id } = await params;
  const fund = await findOwnPensionFund(userId, id);
  if (!fund) return Response.json({ error: "Fondo non trovato" }, { status: 404 });

  const [{ total }] = await db.select({ total: count() }).from(pensionSnapshots).where(eq(pensionSnapshots.fundId, fund.id));
  if (total >= PENSION_MAX_SNAPSHOTS_PER_FUND) return Response.json({ error: "Hai raggiunto il numero massimo di fotografie" }, { status: 400 });

  const [saved] = await db
    .insert(pensionSnapshots)
    .values({ fundId: fund.id, userId, date: input.date, netContributions: input.netContributions.toFixed(2), value: input.value.toFixed(2) })
    .onConflictDoUpdate({
      target: [pensionSnapshots.fundId, pensionSnapshots.date],
      set: { netContributions: input.netContributions.toFixed(2), value: input.value.toFixed(2) },
    })
    .returning({ id: pensionSnapshots.id });
  requestLogger().info("pension.snapshot.saved");
  return Response.json(saved, { status: 201 });
}

export const POST = withRoute("pension.snapshots.create", handlePost);
