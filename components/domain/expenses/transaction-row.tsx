"use client";

/** Riga singola della lista Transazioni in Spese: rendering diverso per source manuale/auto. */

import * as React from "react";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { CurrencyInput } from "@/components/domain/accounts";
import { formatCurrency } from "@/lib/format";
import { useDeleteTransactionMutation, useUpdateTransactionMutation } from "@/lib/queries/transactions";
import type { Transaction } from "@/lib/db/schema/transactions";
import type { Category } from "@/lib/db/schema/categories";
import { SplitSlider } from "./split-slider";
import { CategoryPicker } from "@/components/domain/categories";
import { useCategoryUsageQuery } from "@/lib/queries/categories";
import { TransactionNotePopover } from "./transaction-note-popover";

export interface TransactionRowProps {
  transaction: Transaction;
  categories: Category[];
  currency: string;
}

export function TransactionRow({ transaction, categories, currency }: TransactionRowProps) {
  const isAuto = transaction.source === "auto";
  const updateMutation = useUpdateTransactionMutation();
  const deleteMutation = useDeleteTransactionMutation();
  const { data: categoryUsage } = useCategoryUsageQuery();

  const [description, setDescription] = React.useState(transaction.description);
  const [amountValue, setAmountValue] = React.useState<number | null>(Math.abs(Number(transaction.amount)));
  const [date, setDate] = React.useState(transaction.date);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [splitOpen, setSplitOpen] = React.useState(false);

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

  function commitDescription() {
    if (description.trim() === "" || description === transaction.description) return;
    updateMutation.mutate({ id: transaction.id, input: { description } });
  }

  function commitAmount() {
    if (amountValue === null || amountValue === Math.abs(Number(transaction.amount))) return;
    updateMutation.mutate({ id: transaction.id, input: { amount: amountValue } });
  }

  function commitDate() {
    if (date === transaction.date) return;
    updateMutation.mutate({ id: transaction.id, input: { date } });
  }

  function handleDeleteConfirm() {
    deleteMutation.mutate(transaction.id, {
      onSuccess: () => setDialogOpen(false),
    });
  }

  return (
    <div
      className={
        isUncategorized
          ? "border-b border-border bg-neg-soft/40 last:border-b-0"
          : "border-b border-border last:border-b-0"
      }
    >
      <div className="group flex flex-col gap-3 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="min-w-0 flex-1 space-y-1">
          {isAuto ? (
            <p
              className="truncate text-sm font-medium text-foreground"
              title={
                transaction.rawDescription && transaction.rawDescription !== transaction.description
                  ? transaction.rawDescription
                  : transaction.description
              }
            >
              {transaction.description}
            </p>
          ) : (
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={commitDescription}
              className="h-9 text-sm font-medium sm:h-7"
              aria-label="Descrizione transazione"
            />
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {isAuto ? (
              <span>{transaction.date}</span>
            ) : (
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onBlur={commitDate}
                className="h-9 w-36 text-xs sm:h-6 sm:w-32"
                aria-label="Data transazione"
              />
            )}
            <span>·</span>
            <CategoryPicker
              categories={selectableCategories}
              value={transaction.categoryId}
              onValueChange={commitCategory}
              usage={categoryUsage}
              size="sm"
              className="h-9 max-w-48 text-xs sm:h-6 sm:max-w-40"
            />
          </div>

          {updateMutation.isPending && <p className="text-xs text-muted-foreground">Salvataggio in corso...</p>}
          {updateMutation.isError && <p className="text-xs text-destructive">Salvataggio non riuscito, riprova.</p>}
          {deleteMutation.isError && (
            <p className="text-xs text-destructive">Eliminazione non riuscita, riprova.</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:ml-auto sm:justify-end">
          <Badge variant={isAuto ? "secondary" : "outline"} className="shrink-0">
            {isAuto ? "Auto" : "Manuale"}
          </Badge>

          {isSplit && (
            <Badge variant="ghost" className="shrink-0">
              Diviso
            </Badge>
          )}

          {isUncategorized && (
            <Badge variant="outline" className="shrink-0 gap-1.5 border-neg/40 text-neg">
              <span className="inline-flex size-1.5 rounded-full bg-neg" aria-hidden="true" />
              Da categorizzare
            </Badge>
          )}

          {isAuto ? (
            <div className="w-24 shrink-0 text-right sm:w-28">
              <p className={cn("text-sm font-medium tabular-nums", isIncome && "text-pos")}>
                {isIncome && "+"}
                {formatCurrency(isSplit ? netAmount : fullAmount, currency)}
              </p>
              {isSplit && (
                <p className="text-xs text-muted-foreground line-through">
                  {formatCurrency(fullAmount, currency)}
                </p>
              )}
            </div>
          ) : (
            <div className="w-24 shrink-0 sm:w-28">
              <CurrencyInput
                value={amountValue}
                onChange={setAmountValue}
                onBlur={commitAmount}
                currency={currency}
                className={cn("w-full text-right", isIncome && "text-pos")}
                aria-label={isIncome ? "Importo entrata" : "Importo uscita"}
              />
              {isSplit && (
                <p className="mt-0.5 text-right text-xs text-muted-foreground">
                  Netto: {formatCurrency(netAmount, currency)}
                </p>
              )}
            </div>
          )}

          <TransactionNotePopover transaction={transaction} />

          <button
            type="button"
            onClick={() => setSplitOpen((open) => !open)}
            className="flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted"
            aria-pressed={splitOpen}
            title="Escludi una parte dell'importo dal conteggio (quote di altri, rimborsi, giroconti)"
          >
            Dividi
          </button>

          {!isAuto && (
            <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <AlertDialogTrigger
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Elimina transazione"
              >
                <Trash2Icon className="size-4" />
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
          )}
        </div>
      </div>

      {splitOpen && (
        <SplitSlider transaction={transaction} currency={currency} onClose={() => setSplitOpen(false)} />
      )}
    </div>
  );
}
