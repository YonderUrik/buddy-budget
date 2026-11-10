import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { startOfDay } from "@/lib/calc/expenses";
import { apiError } from "@/lib/http";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";
import { parseTodayParam } from "@/lib/views";
import { loadWidgetSpending } from "@/lib/views/server";

/**
 * GET /api/widgets/spending?today=YYYY-MM-DD — everything the native spending widgets show, in one light call: today,
 * this week (from Monday) and this month spent, the gap from the usual month (Panoramica's month pace), this month's
 * budget (Liquidità · Budget) and the last movement. Session or bearer; `today` is the device day.
 */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const today = parseTodayParam(request);
  if (today === null) return apiError(400, "invalid_date", "today deve avere formato YYYY-MM-DD", { field: "today" });

  const view = await loadWidgetSpending(session.user, { today: today ?? startOfDay(new Date()), now: new Date() });
  requestLogger().info("widgets.spending.served", { budget: view.budget !== null });
  return Response.json(view, { headers: { "Cache-Control": "private, no-store" } });
}

export const GET = withRoute("widgets.spending", handleGet);
