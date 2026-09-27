import { NextRequest } from "next/server";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { backfillDerivedHistory } from "@/lib/net-worth/snapshots";
import { bindRequestUser, withRoute } from "@/lib/observability";

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/net-worth/snapshots?from&to — righe snapshot dell'utente nel periodo; alla prima chiamata ricostruisce lo storico. */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to || !DATE_FORMAT.test(from) || !DATE_FORMAT.test(to)) {
    return Response.json({ error: "from e to sono obbligatori nel formato YYYY-MM-DD" }, { status: 400 });
  }

  await backfillDerivedHistory(session.user.id);

  const rows = await db
    .select()
    .from(netWorthSnapshots)
    .where(
      and(eq(netWorthSnapshots.userId, session.user.id), gte(netWorthSnapshots.date, from), lte(netWorthSnapshots.date, to))
    )
    .orderBy(asc(netWorthSnapshots.date));

  return Response.json(rows);
}

export const GET = withRoute("net_worth.snapshots", handleGet);
