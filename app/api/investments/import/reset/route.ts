import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { previewInvestmentReset, resetInvestmentHistory } from "@/lib/investments/import/reset";
import { todayKey } from "@/lib/investments/operations";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";

/** Preview destructive recovery for the signed-in user's investment history only. */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  return Response.json(await previewInvestmentReset(session.user.id), { headers: { "Cache-Control": "no-store" } });
}

/** Require both the reviewed revision and explicit full-history confirmation. */
async function handleDelete(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const body = z.object({ revision: z.string().regex(/^[a-f0-9]{64}$/), confirmation: z.literal("AZZERA INVESTIMENTI") }).safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Conferma il riepilogo e scrivi AZZERA INVESTIMENTI." }, { status: 400 });
  const result = await resetInvestmentHistory(session.user.id, body.data.revision, todayKey());
  if (result.error) requestLogger().warn("investments.import.reset_conflict", {});
  else requestLogger().info("investments.import.reset_completed", { deleted: result.deletedOperations, count: result.deletedStatements });
  return Response.json(result, { status: result.status });
}
export const GET = withRoute("investment_import.reset_preview", handleGet);
export const DELETE = withRoute("investment_import.reset", handleDelete);
