import { after, NextRequest } from "next/server";
import { sessionOrUnauthorized } from "@/lib/account/route-session";
import { MANUAL_RUN_BUDGET_MS, MAX_GROUPS_MANUAL_RUN } from "@/lib/categorization/ai/suggest-for-user";
import { categorizeNewMovementsSafely } from "@/lib/categorization/auto-apply";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { eq } from "drizzle-orm";
import { requestLogger, withRoute } from "@/lib/observability";

export const maxDuration = 300;

/**
 * POST /api/transactions/categorize-suggestions/generate — chiede all'assistente le proposte per i movimenti già
 * presenti (quelli nuovi le ricevono da soli dopo sync e import); alla fine le proposte sicure si applicano da sole se
 * l'utente lo ha scelto. Risponde subito e lavora in `after()`; il client vede le proposte comparire ricaricando l'elenco. Richiede il consenso dell'utente e la chiave configurata.
 */
async function handlePost(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const userId = session.user.id;

  if (!process.env.OPENROUTER_API_KEY?.trim()) return Response.json({ status: "no_key" });
  const [user] = await db.select({ consentAt: authUser.aiCategorizationConsentAt }).from(authUser).where(eq(authUser.id, userId));
  if (!user?.consentAt) return Response.json({ status: "disabled" });

  after(() => categorizeNewMovementsSafely(userId, undefined, { maxGroups: MAX_GROUPS_MANUAL_RUN, budgetMs: MANUAL_RUN_BUDGET_MS }));
  requestLogger().info("categorization.ai.generate.requested");
  return Response.json({ status: "started" });
}

export const POST = withRoute("transactions.categorize_suggestions_generate", handlePost);
