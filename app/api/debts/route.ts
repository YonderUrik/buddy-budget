import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { debts } from "@/lib/db/schema/debts";
import { loadUserDebts } from "@/lib/debts/data";
import { addDaysIso, todayIso } from "@/lib/debts/dates";
import { buildDebtsView } from "@/lib/debts/view";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { createCreditLineSchema, createDebtSchema } from "@/lib/validation/debts";

/** Vista completa dei debiti dell'utente (piani, totali, scadenze): la usano tutte le schede. */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const { debts: rows, events } = await loadUserDebts(session.user.id);
  return Response.json(buildDebtsView(rows, events, todayIso()));
}

/** Crea un finanziamento (nuovo, ricostruito dall'origine o fotografia di oggi) o, con `kind: "credit_line"`, una linea di credito. */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const body = await request.json().catch(() => null);
  if (body && typeof body === "object" && (body as { kind?: unknown }).kind === "credit_line") return createCreditLine(session.user.id, body);

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

/** Una linea di credito è una riga di `debts` con le colonne dedicate: vedi i commenti dello schema. */
async function createCreditLine(userId: string, body: unknown) {
  const parsed = createCreditLineSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const input = parsed.data;
  // Tolleranza di un giorno: la data dell'utente può essere già "domani" rispetto a UTC.
  if (input.openDate > addDaysIso(todayIso(), 1)) return Response.json({ error: "La data di apertura è nel futuro" }, { status: 400 });

  const [created] = await db
    .insert(debts)
    .values({
      userId,
      kind: "credit_line",
      name: input.name,
      startMode: "nuovo",
      principal: input.initialUsed.toFixed(2),
      annualRate: input.indexRate.toFixed(4),
      installments: 0,
      firstInstallmentDate: input.openDate,
      costs: input.costs,
      creditLimit: input.creditLimit.toFixed(2),
      spread: input.spread.toFixed(4),
      indexLabel: input.indexLabel || null,
      interestFrequency: input.interestFrequency,
      dayCount: input.dayCount,
      capitalizeInterest: input.capitalizeInterest,
      alertThresholdType: input.alertThreshold?.type ?? null,
      alertThresholdValue: input.alertThreshold ? input.alertThreshold.value.toFixed(2) : null,
    })
    .returning();
  return Response.json({ id: created.id }, { status: 201 });
}

export const GET = withRoute("debts.list", handleGet);
export const POST = withRoute("debts.create", handlePost);
