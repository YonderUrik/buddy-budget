import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { loadNetWorthSnapshotRows } from "@/lib/net-worth/snapshot-rows";
import { bindRequestUser, withRoute } from "@/lib/observability";

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/net-worth/snapshots?from&to[&compact=1] — righe snapshot dell'utente nel periodo (con `compact=1` le righe oltre l'ultimo anno si riducono all'ultima di ogni mese); prima ricostruisce lo storico che manca o non è più aggiornato. */
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

  return Response.json(await loadNetWorthSnapshotRows(session.user.id, from, to, { compact: url.searchParams.get("compact") === "1" }));
}

export const GET = withRoute("net_worth.snapshots", handleGet);
