import { NextRequest } from "next/server";
import { sessionOrUnauthorized } from "@/lib/account/route-session";
import { autoApplyCategories, totalApplied } from "@/lib/categorization/auto-apply";
import { requestLogger, withRoute } from "@/lib/observability";

/**
 * POST /api/transactions/categorize-auto — applica subito le regole e le proposte sicure (dal 70%) ai movimenti ancora
 * da categorizzare. Lo chiede la pagina Categorizza quando trova gruppi pronti (per esempio dopo che l'utente ha attivato
 * l'applicazione automatica, o dopo nuove scelte che rendono sicura una proposta). Veloce: solo letture e scritture DB.
 */
async function handlePost(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const result = await autoApplyCategories(session.user.id, { log: requestLogger() });
  return Response.json({ applied: totalApplied(result), groups: result.groups, bySource: result.applied });
}

export const POST = withRoute("transactions.categorize_auto", handlePost);
