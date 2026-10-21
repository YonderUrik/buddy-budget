import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { todayIso } from "@/lib/debts/dates";
import { germanPlanSchema } from "@/lib/financial-planning";
import { planningModel } from "@/lib/financial-planning/registry";
import { apiError, validationError } from "@/lib/http";
import { resolveProfile } from "@/lib/localization/config";
import { countryUnavailableResponse } from "@/lib/localization/guard";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { loadPlanningResults } from "@/lib/views/server";

export const maxDuration = 60;

const bodySchema = z.object({ plan: germanPlanSchema }).strict();

/**
 * POST /api/financial-planning/results `{ plan }` — the results of an unsaved plan (Germany), so the app can show them
 * while the user edits the tax profile: pure computation, nothing is saved (debounce the calls; save with PUT
 * /api/financial-planning). Same shape as `results` in `GET /api/financial-planning?include=results`.
 */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const profile = resolveProfile(session.user);
  if (!planningModel(profile.productCountry)) {
    return countryUnavailableResponse(profile);
  }
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return validationError(body.error);
  if (body.data.plan.country !== profile.productCountry) return apiError(400, "invalid_plan", "invalid_plan");
  return Response.json(await loadPlanningResults(session.user.id, body.data.plan, todayIso()));
}

export const POST = withRoute("financial_plan.results", handlePost);
