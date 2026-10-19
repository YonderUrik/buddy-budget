"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRuleSavedFeedback } from "@/components/domain/categorization";
import { track } from "@/lib/analytics";
import { merchantKey } from "@/lib/categorization/merchant-key";
import { isAutomaticCategorySource } from "@/lib/categorization/category-source";
import type { Category } from "@/lib/db/schema/categories";
import type { Transaction } from "@/lib/db/schema/transactions";
import { useLocalization } from "@/lib/localization/provider";
import { useCreateRuleMutation } from "@/lib/queries/categorization";
import { useUpdateTransactionMutation } from "@/lib/queries/transactions";

/** Message after «Ricordala» when the rule already sorted other transactions to categorise, in the user's language. */
function rememberedMessage(applied: number, categoryName: string, tr: (source: string, values?: Record<string, string | number>) => string): string {
  return applied === 1 ? tr("Messo in {0} anche un altro movimento", { 0: categoryName }) : tr("Messi in {0} anche altri {1} movimenti", { 0: categoryName, 1: applied });
}

/** Where the category was changed, for the correction event. */
export type CategoryChangeSurface = "movimenti" | "dettaglio";

/**
 * Changing the category of one transaction, the same from its row and from its detail: the categories it can take
 * (same direction, transfers, the fallback), the save with «Annulla» in the toast and, with «Ricordala», a rule for the
 * next transactions from the same merchant.
 */
export function useTransactionCategory(transaction: Transaction, categories: readonly Category[], surface: CategoryChangeSurface = "movimenti") {
  const { t: tr } = useLocalization();
  const update = useUpdateTransactionMutation();
  const createRule = useCreateRuleMutation();
  const notifyRuleSaved = useRuleSavedFeedback();
  const isIncome = Number(transaction.amount) > 0;
  const autoSource = isAutomaticCategorySource(transaction.categorySource) ? transaction.categorySource : undefined;

  const selectable = React.useMemo(
    () => categories.filter((c) => c.isFallback || c.type === "trasferimento" || (isIncome ? c.type === "entrata" : c.type !== "entrata")),
    [categories, isIncome]
  );

  function choose(categoryId: string, remember: boolean) {
    const previous = transaction.categoryId;
    const name = categories.find((c) => c.id === categoryId)?.name ?? "";
    update.mutate(
      { id: transaction.id, input: { categoryId } },
      {
        onSuccess: () => {
          track("liquidity_category_remembered", { remembered: remember });
          if (autoSource) track("categorization_auto_corrected", { source: autoSource, count: 1, remember, from: surface });
          // If the merchant already has a rule it takes the new category: otherwise the next ones would go back to the old one.
          if (remember) {
            createRule.mutate(
              { matchType: "merchant", pattern: merchantKey(transaction.description), categoryId, replaceExisting: true },
              { onSuccess: (rule) => notifyRuleSaved(rule, rule.applied > 0 ? rememberedMessage(rule.applied, name, tr) : undefined) }
            );
          }
          toast.success(tr("Spostata in {0}", { 0: name }), {
            action: { label: tr("Annulla"), onClick: () => update.mutate({ id: transaction.id, input: { categoryId: previous } }) },
          });
        },
      }
    );
  }

  return { selectable, choose, update, autoSource };
}
