import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { todayIso } from "@/lib/debts/dates";
import { apiError } from "@/lib/http";
import { withCountryGuard } from "@/lib/localization/guard";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { loadPensionView } from "@/lib/views/server";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/pension/view?fundId=&today=YYYY-MM-DD — the Pensione tabs (Italy) computed on the server (gaps.md G10):
 * performance, contributions, withdrawal estimates, TFR comparison, projection preview, yearly breakdown and the exit-tax
 * timeline per year. `fundId` defaults to the first fund; `today` defaults to the UTC day, as on the web. Germany: 403
 * `country_feature_unavailable`.
 */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const params = request.nextUrl.searchParams;
  const today = params.get("today") ?? todayIso();
  if (!DATE_ONLY.test(today)) return apiError(400, "invalid_date", "today deve avere formato YYYY-MM-DD", { field: "today" });
  const fundId = params.get("fundId") || null;
  if (fundId && !UUID.test(fundId)) return apiError(400, "validation_failed", "fundId non valido", { field: "fundId" });
  const view = await loadPensionView(session.user, { today, fundId });
  if (fundId && view.fund?.id !== fundId) return apiError(404, "pension_fund_not_found", "Fondo non trovato");
  return Response.json(view);
}

export const GET = withRoute("pension.view", withCountryGuard(handleGet));
