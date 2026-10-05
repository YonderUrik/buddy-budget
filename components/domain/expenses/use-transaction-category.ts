"use client";

import * as React from "react";
import { toast } from "sonner";
import { useUpdateTransactionMutation } from "@/lib/queries/transactions";
import type { Category } from "@/lib/db/schema/categories";
import type { Transaction } from "@/lib/db/schema/transactions";

/** Cambio di categoria di una transazione con toast "Annulla" (non per le transazioni ancora senza categoria). Condiviso da riga e dettaglio. */
export function useTransactionCategory(transaction: Transaction, categories: Category[]) {
  const updateMutation = useUpdateTransactionMutation();

  const commitCategory = React.useCallback(
    (categoryId: string) => {
      if (categoryId === transaction.categoryId) return;
      const previousCategoryId = transaction.categoryId;
      const nextName = categories.find((c) => c.id === categoryId)?.name ?? "";
      updateMutation.mutate(
        { id: transaction.id, input: { categoryId } },
        {
          onSuccess: () => {
            if (previousCategoryId === null) return;
            toast.success(`Spostata in ${nextName}`, {
              action: {
                label: "Annulla",
                onClick: () => updateMutation.mutate({ id: transaction.id, input: { categoryId: previousCategoryId } }),
              },
            });
          },
        }
      );
    },
    [categories, transaction.categoryId, transaction.id, updateMutation]
  );

  return { commitCategory, isPending: updateMutation.isPending, isError: updateMutation.isError };
}
