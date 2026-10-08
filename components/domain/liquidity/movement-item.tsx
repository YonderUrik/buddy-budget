"use client";

/** Un movimento con i suoi comportamenti: cambio categoria dall'icona, Dividi, nota e (per i manuali) modifica ed elimina. */

import * as React from "react";
import { PencilIcon, SplitIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { CategoryAvatar } from "@/components/domain/categories";
import { TransactionEditPanel, TransactionNotePopover } from "@/components/domain/expenses";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { track } from "@/lib/analytics";
import { merchantKey } from "@/lib/categorization/merchant-key";
import type { CategoryUsageCounts } from "@/lib/categories/picker";
import type { Category } from "@/lib/db/schema/categories";
import type { Transaction } from "@/lib/db/schema/transactions";
import { useCreateRuleMutation } from "@/lib/queries/categorization";
import { useDeleteTransactionMutation, useUpdateTransactionMutation } from "@/lib/queries/transactions";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { cn } from "@/lib/utils";
import { CategorySheet } from "./category-sheet";
import { MovementRow } from "./movement-row";
import { SplitPanel } from "./split-panel";

export interface MovementItemProps {
  transaction: Transaction;
  categories: readonly Category[];
  usage?: CategoryUsageCounts;
  accountName?: string;
  currency: string;
}

type Panel = "none" | "split" | "edit";

export function MovementItem({ transaction, categories, usage, accountName, currency }: MovementItemProps) {
  const update = useUpdateTransactionMutation();
  const remove = useDeleteTransactionMutation();
  const createRule = useCreateRuleMutation();
  const [panel, setPanel] = React.useState<Panel>("none");
  const [actionsOpen, setActionsOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const full = Math.abs(Number(transaction.amount));
  const excluded = Math.abs(Number(transaction.excludedAmount));
  const isIncome = Number(transaction.amount) > 0;
  const isAuto = transaction.source === "auto";
  const category = categories.find((c) => c.id === transaction.categoryId);
  const uncategorized = category?.isFallback ?? false;
  const selectable = React.useMemo(
    () => categories.filter((c) => c.isFallback || (isIncome ? c.type === "entrata" : c.type !== "entrata")),
    [categories, isIncome]
  );
  const hasRaw = transaction.rawDescription && transaction.rawDescription !== transaction.description;

  function chooseCategory(categoryId: string, remember: boolean) {
    const previous = transaction.categoryId;
    const name = categories.find((c) => c.id === categoryId)?.name ?? "";
    update.mutate(
      { id: transaction.id, input: { categoryId } },
      {
        onSuccess: () => {
          track("liquidity_category_remembered", { remembered: remember });
          if (remember) createRule.mutate({ matchType: "merchant", pattern: merchantKey(transaction.description), categoryId });
          toast.success(`Spostata in ${name}`, {
            action: { label: "Annulla", onClick: () => update.mutate({ id: transaction.id, input: { categoryId: previous } }) },
          });
        },
      }
    );
  }

  function saveSplit(nextExcluded: number) {
    update.mutate(
      { id: transaction.id, input: { excludedAmount: nextExcluded } },
      {
        onSuccess: () => {
          setPanel("none");
        },
      }
    );
  }

  const avatar = category ? (
    <CategorySheet
      categories={selectable}
      value={transaction.categoryId}
      usage={usage}
      rememberLabel={uncategorized || isAuto ? transaction.description : undefined}
      onSelect={chooseCategory}
      trigger={
        <button
          type="button"
          aria-label={`Categoria: ${category.name}. Tocca per cambiarla`}
          className="size-11 shrink-0 rounded-full transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <CategoryAvatar color={category.color as CategoryColor} icon={category.icon as CategoryIcon} size={19} className="size-11" />
        </button>
      }
    />
  ) : (
    <span className="size-11 shrink-0 rounded-full bg-muted" aria-hidden="true" />
  );

  const actionButton = "flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-text-2 hover:bg-muted hover:text-foreground";
  return (
    <li className={cn("rounded-2xl", uncategorized && "bg-neg-soft/50")}>
      <MovementRow
        description={transaction.description}
        rawDescription={hasRaw ? (transaction.rawDescription ?? undefined) : undefined}
        categoryName={category?.name ?? "Senza categoria"}
        uncategorized={uncategorized}
        accountName={accountName}
        amount={full - excluded}
        fullAmount={full}
        excluded={excluded}
        isIncome={isIncome}
        currency={currency}
        avatar={avatar}
        splitOpen={panel === "split"}
        onSplit={() => setPanel((p) => (p === "split" ? "none" : "split"))}
        actionsOpen={actionsOpen}
        actionsId={`azioni-${transaction.id}`}
        onToggleActions={() => setActionsOpen((o) => !o)}
        statusMessage={update.isPending ? "Salvataggio…" : update.isError ? "Salvataggio non riuscito, riprova." : undefined}
      />
      {actionsOpen && (
        <div id={`azioni-${transaction.id}`} className="flex flex-wrap items-center gap-1 px-2 pb-2">
          <button type="button" className={cn(actionButton, "sm:hidden")} onClick={() => setPanel("split")}>
            <SplitIcon className="size-4" aria-hidden="true" /> Dividi
          </button>
          <TransactionNotePopover transaction={transaction} />
          {!isAuto && (
            <>
              <button type="button" className={actionButton} onClick={() => setPanel((p) => (p === "edit" ? "none" : "edit"))}>
                <PencilIcon className="size-4" aria-hidden="true" /> Modifica
              </button>
              <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogTrigger className={cn(actionButton, "hover:bg-destructive/10 hover:text-destructive")}>
                  <Trash2Icon className="size-4" aria-hidden="true" /> Elimina
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminare questo movimento?</AlertDialogTitle>
                    <AlertDialogDescription>«{transaction.description}» verrà eliminato definitivamente.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction disabled={remove.isPending} onClick={() => remove.mutate(transaction.id, { onSuccess: () => setConfirmOpen(false) })}>
                      {remove.isPending ? "Eliminazione…" : "Elimina"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      )}
      {panel === "split" && (
        <SplitPanel
          title={transaction.description}
          total={full}
          excluded={excluded}
          currency={currency}
          isIncome={isIncome}
          saving={update.isPending}
          onSave={saveSplit}
          onCancel={() => setPanel("none")}
        />
      )}
      {panel === "edit" && <TransactionEditPanel transaction={transaction} currency={currency} onClose={() => setPanel("none")} />}
    </li>
  );
}
