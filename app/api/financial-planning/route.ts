import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { sessionOrUnauthorized, readJson } from "@/lib/account/route-session";
import { db } from "@/lib/db/client";
import { financialPlans } from "@/lib/db/schema/financial-plans";
import { planningModel } from "@/lib/financial-planning/registry";
import { germanPlanSchema } from "@/lib/financial-planning";
import { resolveProfile } from "@/lib/localization/config";
import { withRoute, requestLogger } from "@/lib/observability";

async function handleGet(request: Request) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const { productCountry } = resolveProfile(session.user);
  const model = planningModel(productCountry);
  if (!model) return Response.json({ error: "country_feature_unavailable" }, { status: 403 });
  const [row] = await db.select().from(financialPlans).where(and(eq(financialPlans.userId, session.user.id), eq(financialPlans.country, productCountry)));
  return Response.json({ plan: model.schema.parse(row?.data ?? {}), revision: row?.revision ?? 0 });
}
const updateSchema = z.object({ plan: germanPlanSchema, revision: z.number().int().min(0) }).strict();
async function handlePut(request: Request) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const { productCountry } = resolveProfile(session.user);
  if (!planningModel(productCountry)) return Response.json({ error: "country_feature_unavailable" }, { status: 403 });
  const input = updateSchema.safeParse(await readJson(request));
  if (!input.success || input.data.plan.country !== productCountry) return Response.json({ error: "invalid_plan" }, { status: 400 });
  const { plan, revision } = input.data;
  const saved = await db.transaction(async tx => {
    await tx.insert(financialPlans).values({ userId: session.user.id, country: productCountry, data: germanPlanSchema.parse({}) }).onConflictDoNothing();
    const [row] = await tx.update(financialPlans).set({ data: plan, revision: revision + 1, updatedAt: new Date() })
      .where(and(eq(financialPlans.userId, session.user.id), eq(financialPlans.country, productCountry), eq(financialPlans.revision, revision))).returning();
    return row;
  });
  if (!saved) {
    requestLogger().warn("financial_plan.save.conflict", { kind: productCountry });
    return Response.json({ error: "plan_changed" }, { status: 409 });
  }
  requestLogger().info("financial_plan.saved", { kind: productCountry, count: plan.pensions.length });
  return Response.json({ plan: saved.data, revision: saved.revision });
}
export const GET = withRoute("financial_plan.get", handleGet);
export const PUT = withRoute("financial_plan.update", handlePut);
