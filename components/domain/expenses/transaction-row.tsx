"use client";

/** Riga singola della lista Transazioni in Spese: rendering diverso per source manuale/auto. */

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { CategoryAvatar } from "@/components/domain/categories";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";

export interface TransactionRowProps {
  transaction: Transaction;
  categories: Category[];
  currency: string;
}

export function TransactionRow({ transaction, categories, currency }: TransactionRowProps) {
  const isAuto = transaction.source === "auto";
  const updateMutation = useUpdateTransactionMutation();
  const deleteMutation = useDeleteTransactionMutation();

  const [description, setDescription] = React.useState(transaction.description);
  const [amountValue, setAmountValue] = React.useState<number | null>(Math.abs(Number(transaction.amount)));
  const [date, setDate] = React.useState(transaction.date);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [splitOpen, setSplitOpen] = React.useState(false);

  const excludedAmount = Math.abs(Number(transaction.excludedAmount));
  const fullAmount = Math.abs(Number(transaction.amount));
  const netAmount = fullAmount - excludedAmount;
  const isSplit = excludedAmount > 0;

  function commitCategory(categoryId: string | null) {
    if (categoryId === null || categoryId === transaction.categoryId) return;
    updateMutation.mutate({ id: transaction.id, input: { categoryId } });
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
    <div className="border-b border-border last:border-b-0">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1 space-y-1">
          {isAuto ? (
            <p className="truncate text-sm font-medium text-foreground">{transaction.description}</p>
          ) : (
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={commitDescription}
              className="h-7 text-sm font-medium"
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
                className="h-6 w-32 text-xs"
                aria-label="Data transazione"
              />
            )}
            <span>·</span>
            <Select value={transaction.categoryId} onValueChange={commitCategory}>
              <SelectTrigger size="sm" className="h-6 text-xs">
                <SelectValue>
                  {(value: string | null) => {
                    const selected = categories.find((c) => c.id === value);
                    if (!selected) return "";
                    return (
                      <span className="flex items-center gap-1.5">
                        <CategoryAvatar
                          color={selected.color as CategoryColor}
                          icon={selected.icon as CategoryIcon}
                          size={10}
                          className="size-4"
                        />
                        {selected.name}
                      </span>
                    );
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {updateMutation.isPending && <p className="text-xs text-muted-foreground">Salvataggio in corso...</p>}
          {updateMutation.isError && <p className="text-xs text-destructive">Salvataggio non riuscito, riprova.</p>}
          {deleteMutation.isError && (
            <p className="text-xs text-destructive">Eliminazione non riuscita, riprova.</p>
          )}
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          <Badge variant={isAuto ? "secondary" : "outline"} className="shrink-0">
            {isAuto ? "Auto" : "Manuale"}
          </Badge>

          {isSplit && (
            <Badge variant="ghost" className="shrink-0">
              Diviso
            </Badge>
          )}

          {isAuto ? (
            <div className="w-24 shrink-0 text-right sm:w-28">
              <p className="text-sm font-medium tabular-nums">
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
                className="w-full text-right"
                aria-label="Importo"
              />
              {isSplit && (
                <p className="mt-0.5 text-right text-xs text-muted-foreground">
                  Netto: {formatCurrency(netAmount, currency)}
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setSplitOpen((open) => !open)}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
            aria-pressed={splitOpen}
          >
            Dividi
          </button>

          {!isAuto && (
            <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <AlertDialogTrigger
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Elimina transazione"
              >
                ✕
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
