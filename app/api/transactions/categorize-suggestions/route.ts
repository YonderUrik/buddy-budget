import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { autoApplicableGroups, loadCategorizationState } from "@/lib/categorization/load-groups";
import { bindRequestUser, withRoute } from "@/lib/observability";

/**
 * GET /api/transactions/categorize-suggestions — transazioni ancora sulla categoria di fallback,
 * raggruppate per chiave merchant, ciascuna con l'eventuale proposta ricavata dalle regole esistenti,
 * dallo storico già categorizzato o dall'assistente (proposte già salvate). Non interroga mai il modello.
 * `autoApply.readyKeys` elenca i gruppi con una proposta sicura che si applicherebbero da soli: la pagina, se ce
 * ne sono, chiede di applicarli (`POST categorize-auto`) e intanto non li mostra fra quelli da decidere.
 */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

  const state = await loadCategorizationState(session.user.id);
  const readyKeys = autoApplicableGroups(state).map((group) => group.groupKey);
  return Response.json({ groups: state.groups, autoApply: { enabled: state.autoApply, ready: readyKeys.length, readyKeys } });
}

export const GET = withRoute("transactions.categorize_suggestions", handleGet);
