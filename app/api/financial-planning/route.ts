import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { sessionOrUnauthorized, readJson } from "@/lib/account/route-session";
import { db } from "@/lib/db/client";
import { financialPlans } from "@/lib/db/schema/financial-plans";
import { planningModel } from "@/lib/financial-planning/registry";
import { germanPlanSchema } from "@/lib/financial-planning";
import { apiError } from "@/lib/http";
import { todayIso } from "@/lib/debts/dates";
import { loadPlanningResults } from "@/lib/views/server";
import { resolveProfile } from "@/lib/localization/config";
import { countryUnavailableResponse } from "@/lib/localization/guard";
import { bindRequestUser, withRoute, requestLogger } from "@/lib/observability";


/**
 * GET /api/financial-planning[?include=results] — the user's plan document for their product country (Germany only)
 * and, with `include=results`, what the planning sections compute from it and the investment data (gaps.md §5).
 */
async function handleGet(request: Request) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  bindRequestUser(session.user.id);
  const profile = resolveProfile(session.user);
  const { productCountry } = profile;
  const model = planningModel(productCountry);
  if (!model) return countryUnavailableResponse(profile);
  const include = new URL(request.url).searchParams.get("include");
  if (include !== null && include !== "results") return apiError(400, "validation_failed", "include ammette solo results", { field: "include" });
  const [row] = await db.select().from(financialPlans).where(and(eq(financialPlans.userId, session.user.id), eq(financialPlans.country, productCountry)));
  const plan = model.schema.parse(row?.data ?? {});
  const revision = row?.revision ?? 0;
  if (!include) return Response.json({ plan, revision });
  return Response.json({ plan, revision, results: await loadPlanningResults(session.user.id, plan, todayIso()) });
}
const updateSchema = z.object({ plan: germanPlanSchema, revision: z.number().int().min(0) }).strict();
async function handlePut(request: Request) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  bindRequestUser(session.user.id);
  const profile = resolveProfile(session.user);
  const { productCountry } = profile;
  if (!planningModel(productCountry)) return countryUnavailableResponse(profile);
  const input = updateSchema.safeParse(await readJson(request));
  if (!input.success || input.data.plan.country !== productCountry) return apiError(400, "invalid_plan", "invalid_plan");
  const { plan, revision } = input.data;
  const saved = await db.transaction(async tx => {
    await tx.insert(financialPlans).values({ userId: session.user.id, country: productCountry, data: germanPlanSchema.parse({}) }).onConflictDoNothing();
    const [row] = await tx.update(financialPlans).set({ data: plan, revision: revision + 1, updatedAt: new Date() })
      .where(and(eq(financialPlans.userId, session.user.id), eq(financialPlans.country, productCountry), eq(financialPlans.revision, revision))).returning();
    return row;
  });
  if (!saved) {
    requestLogger().warn("financial_plan.save.conflict", { kind: productCountry });
    return apiError(409, "plan_changed", "plan_changed");
  }
  requestLogger().info("financial_plan.saved", { kind: productCountry, count: plan.pensions.length });
  return Response.json({ plan: saved.data, revision: saved.revision });
}
export const GET = withRoute("financial_plan.get", handleGet);
export const PUT = withRoute("financial_plan.update", handlePut);
