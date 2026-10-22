import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { monthKey } from "@/lib/calc/budget-plan";
import { startOfDay } from "@/lib/calc/expenses";
import { apiError } from "@/lib/http";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { budgetMonthParam } from "@/lib/validation/budgets";
import { parseTodayParam } from "@/lib/views";
import { loadBudgetMonth } from "@/lib/views/server";

/**
 * GET /api/budgets/month?month=YYYY-MM&today=YYYY-MM-DD — Liquidità · Budget computed on the server: every budgeted
 * category with the leftover carried from the months before, spent, left and where the month is heading, the totals
 * and the usual income, plus (current month only) the budgets the app proposes. `month` defaults to today's.
 */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const today = parseTodayParam(request);
  if (today === null) return apiError(400, "invalid_date", "today deve avere formato YYYY-MM-DD", { field: "today" });
  const day = today ?? startOfDay(new Date());
  const raw = request.nextUrl.searchParams.get("month");
  const month = raw === null ? monthKey(day) : budgetMonthParam.safeParse(raw).success ? raw : null;
  if (month === null) return apiError(400, "invalid_month", "month deve avere formato YYYY-MM", { field: "month" });

  return Response.json(await loadBudgetMonth(session.user, { today: day, month }));
}

export const GET = withRoute("budgets.month", handleGet);
