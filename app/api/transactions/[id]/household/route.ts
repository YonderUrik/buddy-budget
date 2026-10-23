import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { householdErrorResponse, loadTransactionChoice, setTransactionChoice } from "@/lib/households/server";
import { bindRequestUser, recordHouseholdAction, requestLogger, withRoute } from "@/lib/observability";
import { transactionChoiceSchema } from "@/lib/validation/households";

type Context = { params: Promise<{ id: string }> };

/** Who pays an expense: a group (for everyone or some people), only the viewer, or what a merchant rule decides. */
async function handleGet(request: NextRequest, { params }: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const choice = await loadTransactionChoice(session.user.id, (await params).id);
  return choice ? Response.json(choice) : Response.json({ error: "Movimento non trovato" }, { status: 404 });
}

/** Sets who pays an expense; `rule` decides the merchant's next expenses. */
async function handlePut(request: NextRequest, { params }: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const parsed = transactionChoiceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  try {
    await setTransactionChoice(session.user.id, (await params).id, parsed.data.householdId, parsed.data.forMemberIds, parsed.data.rule);
  } catch (error) {
    const response = householdErrorResponse(error);
    if (!response) throw error;
    return response;
  }
  if (parsed.data.householdId) recordHouseholdAction("expense_shared");
  requestLogger().info("household.expense.updated", { outcome: parsed.data.householdId ? (parsed.data.forMemberIds ? "shared_some" : "shared") : "mine" });
  return new Response(null, { status: 204 });
}

export const GET = withRoute("transactions.household_get", handleGet);
export const PUT = withRoute("transactions.household_set", handlePut);
