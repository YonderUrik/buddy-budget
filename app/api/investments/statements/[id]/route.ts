import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { deleteStatementImports } from "@/lib/investments/import/delete-statements";
import { getUserCurrency, todayKey } from "@/lib/investments/operations";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";

/** Delete only the exact import set reviewed by the user; concurrent history changes require a fresh review. */
async function handleDelete(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const { id } = await params;
  const body = z.object({ confirmedIds: z.array(z.string().uuid()).min(1).max(1000) }).safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !body.success) return Response.json({ error: "Richiesta non valida" }, { status: 400 });
  const result = await deleteStatementImports(session.user.id, id, body.data.confirmedIds, {
    userCurrency: await getUserCurrency(session.user.id), todayKey: todayKey(),
    createInstrument: async () => { throw new Error("Unused"); }, ensureHistory: async () => {}, fetchFx: async () => {},
  });
  if (!result.error) requestLogger().info("investments.import.deleted", { deleted: result.deletedOperations });
  return Response.json(result, { status: result.status });
}
export const DELETE = withRoute("investment_import.delete", handleDelete);
