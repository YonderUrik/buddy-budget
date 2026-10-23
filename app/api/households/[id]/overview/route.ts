import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { loadHouseholdOverview } from "@/lib/households/data";
import { bindRequestUser, withRoute } from "@/lib/observability";

type Context = { params: Promise<{ id: string }> };

const MONTH = /^\d{4}-\d{2}$/;

/** The group view for a month (`?month=YYYY-MM`, default the current one). */
async function handleGet(request: NextRequest, { params }: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const requested = request.nextUrl.searchParams.get("month");
  const month = requested && MONTH.test(requested) ? requested : new Date().toISOString().slice(0, 7);
  const overview = await loadHouseholdOverview(session.user.id, (await params).id, month);
  return overview ? Response.json(overview) : Response.json({ error: "Gruppo non trovato" }, { status: 404 });
}

export const GET = withRoute("households.overview", handleGet);
