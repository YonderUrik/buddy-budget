"use client";

/**
 * Sezione "Da sistemare" della Panoramica: legge i conteggi, le proposte di categorizzazione e le categorie, e
 * mostra `AttentionCard`. Non renderizza nulla finché non c'è almeno una transazione nuova o da categorizzare.
 */

import * as React from "react";
import { track } from "@/lib/analytics";
import { useAttentionQuery } from "@/lib/queries/attention";
import { useApplyCategorizationMutation, useCategorizeSuggestionsQuery } from "@/lib/queries/categorization";
import { useCategoriesQuery, useCategoryUsageQuery } from "@/lib/queries/categories";
import { AttentionCard, type AttentionCardRow } from "./attention-card";
import { ATTENTION_CARD_MAX_ROWS, buildAttentionRows } from "./attention-card.utils";

export interface AttentionSectionProps {
  currency: string;
}

export function AttentionSection({ currency }: AttentionSectionProps) {
  const attention = useAttentionQuery();
  const hasWork = (attention.data?.totalCount ?? 0) > 0;
  // Le proposte e le categorie si leggono solo quando c'è qualcosa da mostrare: la query delle proposte è la più pesante.
  const suggestions = useCategorizeSuggestionsQuery({ enabled: hasWork });
  const categories = useCategoriesQuery();
  const usage = useCategoryUsageQuery();
  const apply = useApplyCategorizationMutation();
  const [confirmingGroupKey, setConfirmingGroupKey] = React.useState<string | null>(null);
  // Scelte dell'utente per riga: finché non tocca nulla vale la proposta; "Dopo" nasconde la riga solo in questa visita.
  const [chosenCategory, setChosenCategory] = React.useState<Record<string, string>>({});
  const [rememberRule, setRememberRule] = React.useState<Record<string, boolean>>({});
  const [skipped, setSkipped] = React.useState<ReadonlySet<string>>(() => new Set());

  const { rows, moreCount } = React.useMemo(() => {
    const newIds = new Set(attention.data?.newTransactionIds ?? []);
    const all = buildAttentionRows(suggestions.data ?? [], newIds, Number.MAX_SAFE_INTEGER).filter((row) => !skipped.has(row.groupKey));
    const shown = all.slice(0, ATTENTION_CARD_MAX_ROWS).map<AttentionCardRow>((row) => ({
      ...row,
      categoryId: chosenCategory[row.groupKey] ?? row.suggestedCategoryId ?? "",
      createRule: rememberRule[row.groupKey] ?? true,
    }));
    return { rows: shown, moreCount: Math.max(0, all.length - shown.length) };
  }, [suggestions.data, attention.data?.newTransactionIds, chosenCategory, rememberRule, skipped]);

  if (!attention.data || !hasWork) return null;

  function handleConfirm(row: AttentionCardRow) {
    const group = suggestions.data?.find((candidate) => candidate.groupKey === row.groupKey);
    if (!group || row.categoryId === "") return;
    const keepsProposal = group.suggestion?.suggestedCategoryId === row.categoryId;
    setConfirmingGroupKey(row.groupKey);
    apply.mutate(
      {
        groups: [
          {
            transactionIds: group.transactionIds,
            categoryId: row.categoryId,
            // La quota esclusa proposta vale solo per la categoria proposta.
            excludedPercentage: keepsProposal ? (group.suggestion?.suggestedSplitPercentage ?? 0) : 0,
            createRule: row.createRule,
            merchantKey: group.merchantKey,
          },
        ],
        onProgress: () => {},
      },
      {
        onSuccess: () => track("attention_quick_confirmed", { groups: 1, changed: !keepsProposal }),
        onSettled: () => setConfirmingGroupKey(null),
      }
    );
  }

  function handleSkip(row: AttentionCardRow) {
    setSkipped((previous) => new Set(previous).add(row.groupKey));
    track("attention_row_skipped");
  }

  return (
    <AttentionCard
      newCount={attention.data.newCount}
      uncategorizedCount={attention.data.uncategorizedCount}
      rows={rows}
      moreCount={moreCount}
      categories={categories.data ?? []}
      categoryUsage={usage.data}
      currency={currency}
      confirmingGroupKey={confirmingGroupKey}
      onConfirm={handleConfirm}
      onCategoryChange={(row, categoryId) => setChosenCategory((previous) => ({ ...previous, [row.groupKey]: categoryId }))}
      onCreateRuleChange={(row, createRule) => setRememberRule((previous) => ({ ...previous, [row.groupKey]: createRule }))}
      onSkip={handleSkip}
      onLinkClick={() => track("attention_link_clicked", { from: "home" })}
    />
  );
}
