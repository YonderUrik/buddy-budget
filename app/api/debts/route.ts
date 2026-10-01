import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { debts } from "@/lib/db/schema/debts";
import { loadUserDebts } from "@/lib/debts/data";
import { todayIso } from "@/lib/debts/events";
import { buildDebtsView } from "@/lib/debts/view";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { createDebtSchema } from "@/lib/validation/debts";

/** Vista completa dei debiti dell'utente (piani, totali, scadenze): la usano tutte le schede. */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const { debts: rows, events } = await loadUserDebts(session.user.id);
  return Response.json(buildDebtsView(rows, events, todayIso()));
}

/** Crea un finanziamento (nuovo, ricostruito dall'origine o fotografia di oggi). */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const parsed = createDebtSchema.safeParse(await request.json().catch(() => null));
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
