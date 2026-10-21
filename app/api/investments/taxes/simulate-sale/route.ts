import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiError, validationError } from "@/lib/http";
import { withCountryGuard } from "@/lib/localization/guard";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { saleSimulationRequestSchema } from "@/lib/views";
import { parseInvestmentsQuery } from "@/lib/views/investments-query";
import { runSaleSimulation } from "@/lib/views/server";

export const maxDuration = 60;

/**
 * POST /api/investments/taxes/simulate-sale?excludeBrokers&today — «Prima di vendere» (Italy, gaps.md G8): `simulateSale`
 * on the user's operations, regime and carryforwards, with the last price and today's FX rate unless given. Pure
 * computation, no writes: call it debounced as the quantity changes. 422 `position_not_sellable` when the instrument
 * is not held or has no price/rate.
 */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const query = parseInvestmentsQuery(request);
  if (query instanceof Response) return query;
  const body = saleSimulationRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return validationError(body.error);
  const result = await runSaleSimulation(session.user, { today: query.today, excludedBrokers: query.excludedBrokers, request: body.data });
  if (!result) return apiError(422, "position_not_sellable", "Posizione non vendibile: non posseduta o senza prezzo", { field: "instrumentId" });
  return Response.json(result);
}

export const POST = withRoute("investments.taxes_simulate_sale", withCountryGuard(handlePost));
