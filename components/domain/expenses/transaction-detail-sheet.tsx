"use client";

/**
 * Dettaglio di una transazione: foglio dal basso su mobile (si chiude trascinando la maniglia verso il basso),
 * pannello laterale da `sm` in su. Raccoglie tutto ciò che si fa su un movimento: categoria, "Dividi" in evidenza,
 * nota e, per le manuali, modifica ed eliminazione. `focus` porta in vista la sezione richiesta (swipe, pulsante Dividi).
 */

import * as React from "react";
import { PencilIcon, Trash2Icon, XIcon } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CategoryPicker } from "@/components/domain/categories";
import { formatCurrency, formatDateWithYear } from "@/lib/format";
import { useCategoryUsageQuery } from "@/lib/queries/categories";
import { useDeleteTransactionMutation } from "@/lib/queries/transactions";
import type { Category } from "@/lib/db/schema/categories";
import type { Transaction } from "@/lib/db/schema/transactions";
import { cn } from "@/lib/utils";
import { SplitSlider } from "./split-slider";
import { TransactionEditPanel } from "./transaction-edit-panel";
import { TransactionNoteField } from "./transaction-note-field";
import { useTransactionCategory } from "./use-transaction-category";

export type TransactionDetailFocus = "dettaglio" | "dividi" | "categoria";

/** Trascinamento verso il basso (px) della maniglia oltre cui il foglio si chiude. */
const SHEET_DISMISS_DISTANCE = 90;

export interface TransactionDetailSheetProps {
  transaction: Transaction;
  categories: Category[];
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Sezione da portare in vista all'apertura. */
  focus?: TransactionDetailFocus;
}

export function TransactionDetailSheet({ transaction, categories, currency, open, onOpenChange, focus = "dettaglio" }: TransactionDetailSheetProps) {
  const isAuto = transaction.source === "auto";
  const isIncome = Number(transaction.amount) > 0;
  const { data: categoryUsage } = useCategoryUsageQuery();
  const { commitCategory } = useTransactionCategory(transaction, categories);
  const deleteMutation = useDeleteTransactionMutation();
  const [editing, setEditing] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [dragY, setDragY] = React.useState(0);
  const dragStart = React.useRef<number | null>(null);
  const categoryRef = React.useRef<HTMLDivElement>(null);
  const splitRef = React.useRef<HTMLDivElement>(null);

  const fullAmount = Math.abs(Number(transaction.amount));
  const excludedAmount = Math.abs(Number(transaction.excludedAmount));
  const isSplit = excludedAmount > 0;
  const selectable = React.useMemo(
    () => categories.filter((c) => c.isFallback || (isIncome ? c.type === "entrata" : c.type !== "entrata")),
    [categories, isIncome]
  );

  React.useEffect(() => {
    if (!open || focus === "dettaglio") return;
    const target = focus === "dividi" ? splitRef.current : categoryRef.current;
    const timer = window.setTimeout(() => target?.scrollIntoView({ block: "center", behavior: "smooth" }), 120);
    return () => window.clearTimeout(timer);
  }, [open, focus]);

  function handleDelete() {
    deleteMutation.mutate(transaction.id, {
      onSuccess: () => {
        setConfirmOpen(false);
        onOpenChange(false);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
        className={cn(
          "inset-x-0 top-auto bottom-0 left-0 max-h-[92dvh] max-w-none translate-x-0 translate-y-0 content-start gap-4 overflow-y-auto rounded-b-none rounded-t-3xl p-4 pb-8",
          "data-open:slide-in-from-bottom data-open:zoom-in-100 data-closed:slide-out-to-bottom data-closed:zoom-out-100",
          "sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[440px] sm:rounded-none sm:p-6",
          "sm:data-open:slide-in-from-right sm:data-open:slide-in-from-bottom-0 sm:data-closed:slide-out-to-right sm:data-closed:slide-out-to-bottom-0"
        )}
      >
        <div
          className="-mt-1 flex h-6 cursor-grab touch-none items-center justify-center sm:hidden"
          aria-hidden="true"
          onPointerDown={(event) => {
            dragStart.current = event.clientY;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (dragStart.current !== null) setDragY(Math.max(0, event.clientY - dragStart.current));
          }}
          onPointerUp={() => {
            const dismiss = dragY > SHEET_DISMISS_DISTANCE;
            dragStart.current = null;
            setDragY(0);
            if (dismiss) onOpenChange(false);
          }}
          onPointerCancel={() => {
            dragStart.current = null;
            setDragY(0);
          }}
        >
          <span className="h-1.5 w-11 rounded-full bg-border" />
        </div>
        <DialogClose
          render={<Button variant="ghost" size="icon" className="absolute top-3 right-3 size-11" aria-label="Chiudi" />}
        >
          <XIcon className="size-5" aria-hidden="true" />
        </DialogClose>

        <header className="flex flex-col gap-1 pr-10">
          <DialogTitle className="font-heading text-lg font-medium text-foreground">{transaction.description}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <time dateTime={transaction.date}>{formatDateWithYear(transaction.date)}</time>
            <Badge variant="outline">{isAuto ? "Dalla banca" : "Manuale"}</Badge>
          </DialogDescription>
          <p className={cn("font-heading text-3xl font-medium tabular-nums", isIncome && "text-pos")}>
            {isIncome && "+"}
            {formatCurrency(fullAmount - excludedAmount, currency)}
          </p>
          {isSplit && (
            <p className="text-xs text-muted-foreground">
              Importo sul conto <span className="tabular-nums line-through">{formatCurrency(fullAmount, currency)}</span>
            </p>
          )}
        </header>

        <div ref={categoryRef} className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categoria</span>
          <CategoryPicker
            categories={selectable}
            value={transaction.categoryId ?? ""}
            onValueChange={commitCategory}
            usage={categoryUsage}
            aria-label="Categoria"
            className="h-11 w-full"
          />
        </div>

        <div ref={splitRef}>
          <SplitSlider transaction={transaction} currency={currency} />
        </div>

        <TransactionNoteField transaction={transaction} />

        {!isAuto && (
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            {editing ? (
              <div className="overflow-hidden rounded-xl border border-border">
                <TransactionEditPanel transaction={transaction} currency={currency} onClose={() => setEditing(false)} />
              </div>
            ) : (
              <Button variant="outline" className="h-11 justify-start gap-2" onClick={() => setEditing(true)}>
                <PencilIcon className="size-4" aria-hidden="true" /> Modifica descrizione, data e importo
              </Button>
            )}
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogTrigger
                render={<Button variant="ghost" className="h-11 justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive" />}
              >
                <Trash2Icon className="size-4" aria-hidden="true" /> Elimina transazione
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminare questa transazione?</AlertDialogTitle>
                  <AlertDialogDescription>&quot;{transaction.description}&quot; verrà eliminata definitivamente.</AlertDialogDescription>
                </AlertDialogHeader>
                {deleteMutation.isError && <p className="text-sm text-destructive">Eliminazione non riuscita, riprova.</p>}
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending}>
                    {deleteMutation.isPending ? "Eliminazione..." : "Elimina"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
