import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { debts } from "@/lib/db/schema/debts";
import { loadUserDebts } from "@/lib/debts/data";
import { todayIso } from "@/lib/debts/dates";
import { buildDebtsView } from "@/lib/debts/view";
import { buildDebtsInsights } from "@/lib/debts/overview-insights";
import { apiError } from "@/lib/http";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { createDebtSchema } from "@/lib/validation/debts";

/**
 * The user's full debts view (plans, totals, due dates), used by every tab. `?include=insights` adds the overview
 * readings the web computes in the browser (interest shares, repaid share, exit plan per slider step; gaps.md G12).
 */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const include = request.nextUrl.searchParams.get("include");
  if (include !== null && include !== "insights") return apiError(400, "validation_failed", "include ammette solo insights", { field: "include" });
  const today = todayIso();
  const { debts: rows, events } = await loadUserDebts(session.user.id);
  const view = buildDebtsView(rows, events, today);
  return Response.json(include ? { ...view, insights: buildDebtsInsights(view.debts, today) } : view);
}

/** Crea un finanziamento (nuovo, ricostruito dall'origine o fotografia di oggi). */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const body = await request.json().catch(() => null);

  const parsed = createDebtSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const input = parsed.data;

  const [created] = await db
    .insert(debts)
    .values({
      userId: session.user.id,
      kind: "loan",
      name: input.name,
      startMode: input.startMode,
      principal: input.principal.toFixed(2),
      annualRate: input.annualRate.toFixed(4),
      installments: input.installments,
      firstInstallmentDate: input.firstInstallmentDate,
      installment: input.installment !== undefined ? input.installment.toFixed(2) : null,
      anchorDate: input.startMode === "fotografia" ? (input.anchorDate ?? null) : null,
      costs: input.costs,
    })
    .returning();
  return Response.json({ id: created.id }, { status: 201 });
}

export const GET = withRoute("debts.list", handleGet);
export const POST = withRoute("debts.create", handlePost);
