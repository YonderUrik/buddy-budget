"use client";

/**
 * Sezione "Da sistemare" della Panoramica: legge i conteggi, le proposte di categorizzazione e le categorie, e
 * mostra `AttentionCard`. Non renderizza nulla finché non c'è almeno una transazione nuova o da categorizzare.
 */

import * as React from "react";
import { track } from "@/lib/analytics";
import { useAttentionQuery } from "@/lib/queries/attention";
import { useApplyCategorizationMutation, useCategorizeSuggestionsQuery } from "@/lib/queries/categorization";
import { useCategoriesQuery } from "@/lib/queries/categories";
import { AttentionCard, type AttentionCardRow } from "./attention-card";
import { buildAttentionRows } from "./attention-card.utils";

export interface AttentionSectionProps {
  currency: string;
}

export function AttentionSection({ currency }: AttentionSectionProps) {
  const attention = useAttentionQuery();
  const hasWork = (attention.data?.totalCount ?? 0) > 0;
  // Le proposte e le categorie si leggono solo quando c'è qualcosa da mostrare: la query delle proposte è la più pesante.
  const suggestions = useCategorizeSuggestionsQuery({ enabled: hasWork });
  const categories = useCategoriesQuery();
  const apply = useApplyCategorizationMutation();
  const [confirmingGroupKey, setConfirmingGroupKey] = React.useState<string | null>(null);

  const rows = React.useMemo<AttentionCardRow[]>(() => {
    const names = new Map((categories.data ?? []).map((category) => [category.id, category.name]));
    const newIds = new Set(attention.data?.newTransactionIds ?? []);
    return buildAttentionRows(suggestions.data ?? [], newIds).map((row) => ({
      ...row,
      // Una proposta con categoria sconosciuta non è confermabile: si ripiega sulla scelta manuale.
      suggestedCategoryName: row.suggestedCategoryId ? (names.get(row.suggestedCategoryId) ?? null) : null,
    }));
  }, [suggestions.data, categories.data, attention.data?.newTransactionIds]);

  if (!attention.data || !hasWork) return null;

  function handleConfirm(row: AttentionCardRow) {
    const group = suggestions.data?.find((candidate) => candidate.groupKey === row.groupKey);
    if (!group?.suggestion) return;
    setConfirmingGroupKey(row.groupKey);
    apply.mutate(
      {
        groups: [
          {
            transactionIds: group.transactionIds,
            categoryId: group.suggestion.suggestedCategoryId,
            excludedPercentage: group.suggestion.suggestedSplitPercentage ?? 0,
            createRule: true,
            merchantKey: group.merchantKey,
          },
        ],
        onProgress: () => {},
      },
      {
        onSuccess: () => track("attention_quick_confirmed", { groups: 1 }),
        onSettled: () => setConfirmingGroupKey(null),
      }
    );
  }

  return (
    <AttentionCard
      newCount={attention.data.newCount}
      uncategorizedCount={attention.data.uncategorizedCount}
      rows={rows}
      currency={currency}
      confirmingGroupKey={confirmingGroupKey}
      onConfirm={handleConfirm}
      onLinkClick={() => track("attention_link_clicked", { from: "home" })}
    />
  );
}
