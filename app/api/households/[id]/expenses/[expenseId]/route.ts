import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { deleteGroupExpense, householdErrorResponse, updateGroupExpense } from "@/lib/households/server";
import { bindRequestUser, recordHouseholdAction, requestLogger, withRoute } from "@/lib/observability";
import { groupExpenseSchema } from "@/lib/validation/households";

type Context = { params: Promise<{ id: string; expenseId: string }> };

/** Changes an expense written in the group (any member can). */
async function handlePatch(request: NextRequest, { params }: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const parsed = groupExpenseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { id, expenseId } = await params;
  try {
    await updateGroupExpense(session.user.id, id, expenseId, parsed.data);
  } catch (error) {
    const response = householdErrorResponse(error);
    if (!response) throw error;
    return response;
  }
  recordHouseholdAction("group_expense_saved");
  requestLogger().info("household.group_expense.updated", { outcome: parsed.data.forMemberIds ? "some" : "all" });
  return new Response(null, { status: 204 });
}

/** Deletes an expense written in the group. */
async function handleDelete(request: NextRequest, { params }: Context) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const { id, expenseId } = await params;
  try {
    await deleteGroupExpense(session.user.id, id, expenseId);
  } catch (error) {
    const response = householdErrorResponse(error);
    if (!response) throw error;
    return response;
  }
  recordHouseholdAction("group_expense_deleted");
  requestLogger().info("household.group_expense.deleted");
  return new Response(null, { status: 204 });
}

export const PATCH = withRoute("households.expense_update", handlePatch);
export const DELETE = withRoute("households.expense_delete", handleDelete);
