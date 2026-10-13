import { NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { pensionSnapshots } from "@/lib/db/schema/pension";
import { todayIso } from "@/lib/debts/dates";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";
import { findOwnPensionFund } from "@/lib/pension/data";
import { planSnapshotImport } from "@/lib/pension/import/plan";
import { PENSION_MAX_SNAPSHOTS_PER_FUND } from "@/lib/pension/limits";
import { importPensionSnapshotsSchema } from "@/lib/validation/pension";

type Params = { params: Promise<{ id: string }> };

/** Scritture per query: tiene piccole le istruzioni anche con il massimo delle righe. */
const WRITE_CHUNK_SIZE = 200;

/**
 * Importa in blocco le fotografie di un fondo da righe già lette dal client (il file non arriva qui, quindi non si
 * conserva né si logga nulla del suo contenuto). Il piano è lo stesso dell'anteprima, ricalcolato sullo stato vero:
 * se c'è un errore non si scrive niente (400 col piano), altrimenti si aggiunge o aggiorna tutto in una transazione.
 */
async function handlePost(request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const userId = session.user.id;

  const parsed = importPensionSnapshotsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { id } = await params;
  const fund = await findOwnPensionFund(userId, id);
  if (!fund) return Response.json({ error: "Fondo non trovato" }, { status: 404 });

  const existing = (await db.select().from(pensionSnapshots).where(eq(pensionSnapshots.fundId, fund.id))).map((s) => ({
    date: s.date,
    netContributions: Number(s.netContributions),
    value: Number(s.value),
  }));
  const plan = planSnapshotImport(parsed.data.rows, existing, todayIso(), PENSION_MAX_SNAPSHOTS_PER_FUND);
  if (plan.error || plan.counts.error > 0) {
    requestLogger().warn("pension.snapshots.import_rejected", { rejected: plan.counts.error });
    return Response.json({ error: plan.error ?? "Alcune righe non sono valide", ...plan }, { status: 400 });
  }

  const written = new Set(plan.rows.filter((r) => r.status === "new" || r.status === "update").map((r) => r.line));
  const values = parsed.data.rows
    .filter((r) => written.has(r.line))
    .map((r) => ({ fundId: fund.id, userId, date: r.date, netContributions: r.netContributions.toFixed(2), value: r.value.toFixed(2) }));
  await db.transaction(async (tx) => {
    for (let i = 0; i < values.length; i += WRITE_CHUNK_SIZE) {
      await tx
        .insert(pensionSnapshots)
        .values(values.slice(i, i + WRITE_CHUNK_SIZE))
        .onConflictDoUpdate({
          target: [pensionSnapshots.fundId, pensionSnapshots.date],
          set: { netContributions: sql`excluded.net_contributions`, value: sql`excluded.value` },
        });
    }
  });
  requestLogger().info("pension.snapshots.imported", { created: plan.counts.new, updated: plan.counts.update, skipped: plan.counts.unchanged });
  return Response.json({ counts: plan.counts }, { status: 201 });
}

export const POST = withRoute("pension.snapshots.import", handlePost);
