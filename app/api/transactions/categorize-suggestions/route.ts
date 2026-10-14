import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { autoApplicableGroups, loadCategorizationState } from "@/lib/categorization/load-groups";
import { withMerchantLogos } from "@/lib/categorization/merchant-logo/attach";
import { bindRequestUser, withRoute } from "@/lib/observability";

/**
 * GET /api/transactions/categorize-suggestions — transazioni ancora sulla categoria di fallback,
 * raggruppate per chiave merchant, ciascuna con l'eventuale proposta ricavata dalle regole esistenti,
 * dallo storico già categorizzato o dall'assistente (proposte già salvate). Non interroga mai il modello.
 * `autoApply.readyKeys` elenca i gruppi con una proposta sicura che si applicherebbero da soli: la pagina, se ce
 * ne sono, chiede di applicarli (`POST categorize-auto`) e intanto non li mostra fra quelli da decidere.
 * Ogni gruppo ha `logoPath`: il logo del marchio (dizionario, sito scritto nel movimento o nome da cercare), o null.
 */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

  const state = await loadCategorizationState(session.user.id);
  const readyKeys = autoApplicableGroups(state).map((group) => group.groupKey);
  const groups = await withMerchantLogos(
    state.groups,
    (group) => ({
      label: group.label,
      texts: group.transactionIds.flatMap((id) => {
        const row = state.uncategorized.get(id);
        return row ? [row.description, row.rawDescription] : [];
      }),
      isExpense: group.totalAmount < 0,
    }),
    session.user.id
  );
  return Response.json({ groups, autoApply: { enabled: state.autoApply, ready: readyKeys.length, readyKeys } });
}

export const GET = withRoute("transactions.categorize_suggestions", handleGet);
