import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { debts } from "@/lib/db/schema/debts";
import { findOwnDebt } from "@/lib/debts/data";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { updateDebtSchema } from "@/lib/validation/debts";

type Params = { params: Promise<{ id: string }> };

/** Modifica nome e spese di un debito dell'utente e, per una linea di credito, fido, spread, regole di addebito e soglia. */
async function handlePatch(request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const parsed = updateDebtSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { alertThreshold, creditLimit, spread, indexLabel, ...rest } = parsed.data;
  const lineChanges = { alertThreshold, creditLimit, spread, indexLabel, interestFrequency: rest.interestFrequency, dayCount: rest.dayCount, capitalizeInterest: rest.capitalizeInterest };
  const { id } = await params;
  if (Object.values(lineChanges).some((value) => value !== undefined)) {
    const debt = await findOwnDebt(session.user.id, id);
    if (debt && debt.kind !== "credit_line") return Response.json({ error: "Queste impostazioni valgono solo per una linea di credito" }, { status: 400 });
  }
  const [updated] = await db
    .update(debts)
    .set({
      name: rest.name,
      costs: rest.costs,
      creditLimit: creditLimit?.toFixed(2),
      spread: spread?.toFixed(4),
      indexLabel: indexLabel === undefined ? undefined : indexLabel || null,
      interestFrequency: rest.interestFrequency,
      dayCount: rest.dayCount,
      capitalizeInterest: rest.capitalizeInterest,
      // `null` toglie la soglia, `undefined` la lascia com'è.
      alertThresholdType: alertThreshold === undefined ? undefined : (alertThreshold?.type ?? null),
      alertThresholdValue: alertThreshold === undefined ? undefined : alertThreshold ? alertThreshold.value.toFixed(2) : null,
      updatedAt: new Date(),
    })
    .where(and(eq(debts.id, id), eq(debts.userId, session.user.id)))
    .returning({ id: debts.id });
  return updated ? Response.json(updated) : Response.json({ error: "Debito non trovato" }, { status: 404 });
}

/** Elimina un debito dell'utente con tutti i suoi eventi. */
async function handleDelete(request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const { id } = await params;
  const deleted = await db
    .delete(debts)
    .where(and(eq(debts.id, id), eq(debts.userId, session.user.id)))
    .returning({ id: debts.id });
  return deleted.length > 0 ? new Response(null, { status: 204 }) : Response.json({ error: "Debito non trovato" }, { status: 404 });
}

export const PATCH = withRoute("debts.update", handlePatch);
export const DELETE = withRoute("debts.delete", handleDelete);
