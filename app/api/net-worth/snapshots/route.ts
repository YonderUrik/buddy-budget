import { NextRequest } from "next/server";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { loadUserDebts } from "@/lib/debts/data";
import { todayIso } from "@/lib/debts/dates";
import { buildDebtsView } from "@/lib/debts/view";
import { buildDebtHistoryRows } from "@/lib/net-worth/debt-history";
import { refreshDerivedInvestmentHistory } from "@/lib/net-worth/investments";
import { backfillDerivedHistory } from "@/lib/net-worth/snapshots";
import { bindRequestUser, withRoute } from "@/lib/observability";

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/net-worth/snapshots?from&to — righe snapshot dell'utente nel periodo; prima ricostruisce lo storico che manca o non è più aggiornato. */
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
  await refreshDerivedInvestmentHistory(session.user.id);

  const rows = await db
    .select()
    .from(netWorthSnapshots)
    .where(
      and(eq(netWorthSnapshots.userId, session.user.id), gte(netWorthSnapshots.date, from), lte(netWorthSnapshots.date, to))
    )
    .orderBy(asc(netWorthSnapshots.date));

  // Il debito non si salva: lo storico si ricalcola da piani ed eventi, così segue ogni modifica.
  const today = todayIso();
  const { debts: debtRows, events } = await loadUserDebts(session.user.id);
  const debtHistory = buildDebtHistoryRows(buildDebtsView(debtRows, events, today), today, from).filter((r) => r.date <= to);

  return Response.json([...rows, ...debtHistory]);
}

export const GET = withRoute("net_worth.snapshots", handleGet);
