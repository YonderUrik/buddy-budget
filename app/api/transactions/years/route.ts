import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { transactionYears } from "@/lib/transactions/years";

/**
 * GET /api/transactions/years — the years with movements, newest first. Movimenti loads one window by default and
 * uses this to offer older years on demand, skipping the empty ones.
 */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  return Response.json({ years: await transactionYears(session.user.id) });
}

export const GET = withRoute("transactions.years", handleGet, { quietOnSuccess: true });
