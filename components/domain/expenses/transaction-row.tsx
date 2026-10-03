"use client";

/**
 * Riga singola della lista Transazioni. In alto descrizione e importo, sotto data e categoria
 * (l'unica cosa che si cambia spesso, quindi sempre a portata). Le azioni secondarie (nota, Dividi,
 * Modifica/Elimina per le manuali) stanno inline da `sm` in su e dietro il bottone "⋯" su mobile.
 */

import * as React from "react";
import { EllipsisIcon, PencilIcon, SplitIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
import { formatCurrency, formatShortDate } from "@/lib/format";
import { useDeleteTransactionMutation, useUpdateTransactionMutation } from "@/lib/queries/transactions";
import type { Transaction } from "@/lib/db/schema/transactions";
import { mccLabel } from "@/lib/categorization/merchant-name";
import type { Category } from "@/lib/db/schema/categories";
import { SplitSlider } from "./split-slider";
import { CategoryPicker } from "@/components/domain/categories";
import { useCategoryUsageQuery } from "@/lib/queries/categories";
import { TransactionNotePopover } from "./transaction-note-popover";
import { TransactionEditPanel } from "./transaction-edit-panel";

export interface TransactionRowProps {
  transaction: Transaction;
  categories: Category[];
  currency: string;
}

/** Stile comune dei bottoni azione: con etichetta su mobile, solo icona (o etichetta breve) da `sm`. */
const ACTION_BUTTON_CLASS =
  "flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:h-8 sm:px-2";

type OpenPanel = "none" | "split" | "edit";

export function TransactionRow({ transaction, categories, currency }: TransactionRowProps) {
  const isAuto = transaction.source === "auto";
  const updateMutation = useUpdateTransactionMutation();
  const deleteMutation = useDeleteTransactionMutation();
  const { data: categoryUsage } = useCategoryUsageQuery();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [actionsOpen, setActionsOpen] = React.useState(false);
  const [openPanel, setOpenPanel] = React.useState<OpenPanel>("none");

  const excludedAmount = Math.abs(Number(transaction.excludedAmount));
  const fullAmount = Math.abs(Number(transaction.amount));
  const netAmount = fullAmount - excludedAmount;
  const isSplit = excludedAmount > 0;
  const isIncome = Number(transaction.amount) > 0;
  const currentCategory = categories.find((c) => c.id === transaction.categoryId);
  const isUncategorized = currentCategory?.isFallback ?? false;
  const selectableCategories = React.useMemo(
    () => categories.filter((c) => c.isFallback || (isIncome ? c.type === "entrata" : c.type !== "entrata")),
    [categories, isIncome]
  );
  const descriptionTitle =
    transaction.rawDescription && transaction.rawDescription !== transaction.description
      ? transaction.rawDescription
      : transaction.description;

  const merchantKind = mccLabel(transaction.merchantCategoryCode);

  function togglePanel(panel: Exclude<OpenPanel, "none">) {
    setOpenPanel((current) => (current === panel ? "none" : panel));
  }

  function commitCategory(categoryId: string) {
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
  }

  function handleDeleteConfirm() {
    deleteMutation.mutate(transaction.id, {
      onSuccess: () => setDialogOpen(false),
    });
  }

  return (
    <div className={cn("border-b border-border last:border-b-0", isUncategorized && "bg-neg-soft/40")}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3 sm:flex-nowrap sm:items-center">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-medium text-foreground" title={descriptionTitle}>
            {transaction.description}
          </p>
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <time dateTime={transaction.date} className="shrink-0 tabular-nums">
              {formatShortDate(transaction.date)}
            </time>
            <span aria-hidden="true">·</span>
            <CategoryPicker
              categories={selectableCategories}
              value={transaction.categoryId}
              onValueChange={commitCategory}
              usage={categoryUsage}
              size="sm"
              className={cn(
                "max-w-44 text-xs data-[size=sm]:h-8 sm:max-w-48 sm:data-[size=sm]:h-7",
                isUncategorized && "border-neg/40 text-neg"
              )}
            />
            {merchantKind && (
              <>
                <span aria-hidden="true" className="hidden sm:inline">·</span>
                <span className="hidden shrink-0 truncate sm:inline" title="Tipo di esercente indicato dalla banca">
                  {merchantKind}
                </span>
              </>
            )}
            {!isAuto && (
              <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
                Manuale
              </Badge>
            )}
          </div>

          {updateMutation.isPending && <p className="text-xs text-muted-foreground">Salvataggio in corso...</p>}
          {updateMutation.isError && <p className="text-xs text-destructive">Salvataggio non riuscito, riprova.</p>}
        </div>

        <div className="shrink-0 text-right">
          <p className={cn("text-sm font-medium tabular-nums", isIncome && "text-pos")}>
            {isIncome && "+"}
            {formatCurrency(isSplit ? netAmount : fullAmount, currency)}
          </p>
          {isSplit && (
            <p className="text-xs text-muted-foreground">
              <span className="sr-only">Diviso, importo pieno </span>
              <span className="line-through">{formatCurrency(fullAmount, currency)}</span>
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setActionsOpen((open) => !open)}
          aria-expanded={actionsOpen}
          aria-controls={`azioni-${transaction.id}`}
          aria-label="Altre azioni"
          className="-mr-2 flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted sm:hidden"
        >
          <EllipsisIcon className="size-4" aria-hidden="true" />
        </button>

        <div
          id={`azioni-${transaction.id}`}
          className={cn(
            "-ml-2.5 w-full flex-wrap items-center gap-1 sm:ml-0 sm:flex sm:w-auto sm:flex-nowrap",
            actionsOpen ? "flex" : "hidden"
          )}
        >
          <TransactionNotePopover transaction={transaction} />

          <button
            type="button"
            onClick={() => togglePanel("split")}
            className={cn(ACTION_BUTTON_CLASS, openPanel === "split" && "bg-muted text-foreground")}
            aria-pressed={openPanel === "split"}
            title="Escludi una parte dell'importo dal conteggio (quote di altri, rimborsi, giroconti)"
          >
            <SplitIcon className="size-4 sm:hidden" aria-hidden="true" />
            Dividi
          </button>

          {!isAuto && (
            <>
              <button
                type="button"
                onClick={() => togglePanel("edit")}
                className={cn(ACTION_BUTTON_CLASS, openPanel === "edit" && "bg-muted text-foreground")}
                aria-pressed={openPanel === "edit"}
                aria-label="Modifica transazione"
              >
                <PencilIcon className="size-4" aria-hidden="true" />
                <span className="sm:sr-only">Modifica</span>
              </button>

              <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <AlertDialogTrigger
                  className={cn(ACTION_BUTTON_CLASS, "hover:bg-destructive/10 hover:text-destructive")}
                  aria-label="Elimina transazione"
                >
                  <Trash2Icon className="size-4" aria-hidden="true" />
                  <span className="sm:sr-only">Elimina</span>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminare questa transazione?</AlertDialogTitle>
                    <AlertDialogDescription>
                      &quot;{transaction.description}&quot; verrà eliminata definitivamente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  {deleteMutation.isError && (
                    <p className="text-sm text-destructive">Eliminazione non riuscita, riprova.</p>
                  )}
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteConfirm} disabled={deleteMutation.isPending}>
                      {deleteMutation.isPending ? "Eliminazione..." : "Elimina"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {openPanel === "split" && (
        <SplitSlider transaction={transaction} currency={currency} onClose={() => setOpenPanel("none")} />
      )}
      {openPanel === "edit" && (
        <TransactionEditPanel transaction={transaction} currency={currency} onClose={() => setOpenPanel("none")} />
      )}
    </div>
  );
}
