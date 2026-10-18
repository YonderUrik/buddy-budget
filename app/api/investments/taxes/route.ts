import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withCountryGuard } from "@/lib/localization/guard";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { parseInvestmentsQuery } from "@/lib/views/investments-query";
import { loadInvestmentsTaxes } from "@/lib/views/server";

export const maxDuration = 60;

/**
 * GET /api/investments/taxes?excludeBrokers&today — Tasse (Italy) computed on the server (gaps.md G8): `buildTaxView`
 * (yearly report, bollo, zainetto fiscale — loss carryforwards —, opportunities, rates, sellable positions). The sale
 * simulator is `POST /api/investments/taxes/simulate-sale`. Germany: 403 `country_feature_unavailable`.
 */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const query = parseInvestmentsQuery(request);
  if (query instanceof Response) return query;
  return Response.json(await loadInvestmentsTaxes(session.user.id, query));
}

export const GET = withRoute("investments.taxes", withCountryGuard(handleGet));
