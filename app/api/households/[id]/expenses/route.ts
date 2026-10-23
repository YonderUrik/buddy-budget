import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { loadHouseholdExpenses } from "@/lib/households/data";
import { createGroupExpense, householdErrorResponse } from "@/lib/households/server";
import { bindRequestUser, recordHouseholdAction, requestLogger, withRoute } from "@/lib/observability";
import { groupExpenseSchema } from "@/lib/validation/households";

type Context = { params: Promise<{ id: string }> };

/** Every expense that counts between the members, newest first, with what each means for the viewer. */
async function handleGet(request: NextRequest, { params }: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const list = await loadHouseholdExpenses(session.user.id, (await params).id);
  return list ? Response.json(list) : Response.json({ error: "Gruppo non trovato" }, { status: 404 });
}

/** «Aggiungi una spesa»: an expense written in the group, paid by any member, for everyone or some of them. */
async function handlePost(request: NextRequest, { params }: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const parsed = groupExpenseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  try {
    const id = await createGroupExpense(session.user.id, (await params).id, parsed.data);
    recordHouseholdAction("group_expense_saved");
    requestLogger().info("household.group_expense.created", { outcome: parsed.data.forMemberIds ? "some" : "all" });
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    const response = householdErrorResponse(error);
    if (!response) throw error;
    return response;
  }
}

export const GET = withRoute("households.expenses_list", handleGet);
export const POST = withRoute("households.expense_create", handlePost);
