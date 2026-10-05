"use client";

/**
 * Riga della lista Movimenti. Su mobile si scorre (swipe): a sinistra compaiono "Dividi" e "Dettaglio", a destra
 * "Categoria"; il tocco apre il dettaglio. Da `sm` in su il gesto non c'è: "Dividi" e "Dettaglio" sono pulsanti
 * sempre visibili, la categoria si cambia dal selettore in riga e, se la transazione è divisa, compare la colonna
 * "Tua quota". Tutto il resto (nota, modifica, elimina) sta nel dettaglio (`TransactionDetailSheet`).
 */

import * as React from "react";
import { ChevronRightIcon, SplitIcon, TagIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CategoryAvatar, CategoryPicker } from "@/components/domain/categories";
import { track } from "@/lib/analytics";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { mccLabel } from "@/lib/categorization/merchant-name";
import { useCategoryUsageQuery } from "@/lib/queries/categories";
import type { Transaction } from "@/lib/db/schema/transactions";
import type { Category } from "@/lib/db/schema/categories";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { dismissSwipeHint } from "./swipe-hint";
import { TransactionDetailSheet, type TransactionDetailFocus } from "./transaction-detail-sheet";
import { useSwipeReveal } from "./use-swipe-reveal";
import { useTransactionCategory } from "./use-transaction-category";

export interface TransactionRowProps {
  transaction: Transaction;
  categories: Category[];
  currency: string;
}

/** Larghezza (px) di un pulsante azione dello swipe. */
const SWIPE_ACTION_WIDTH = 76;
const SWIPE_RIGHT_ACTIONS = 2;
const SWIPE_LEFT_ACTIONS = 1;
/** Selettore degli elementi interattivi in riga: un clic su di essi non apre il dettaglio. */
const INTERACTIVE_SELECTOR = "button, a, input, [role='combobox'], [role='option']";

const SWIPE_BUTTON_CLASS = "flex flex-col items-center justify-center gap-1 text-xs font-semibold";

export function TransactionRow({ transaction, categories, currency }: TransactionRowProps) {
  const isAuto = transaction.source === "auto";
  const { data: categoryUsage } = useCategoryUsageQuery();
  const { commitCategory, isPending, isError } = useTransactionCategory(transaction, categories);
  const swipe = useSwipeReveal({
    rightWidth: SWIPE_ACTION_WIDTH * SWIPE_RIGHT_ACTIONS,
    leftWidth: SWIPE_ACTION_WIDTH * SWIPE_LEFT_ACTIONS,
  });
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [sheetFocus, setSheetFocus] = React.useState<TransactionDetailFocus>("dettaglio");

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
  const swipeOpen = swipe.side !== "closed";

  // Il primo swipe riuscito chiude per sempre il suggerimento in cima all'elenco.
  React.useEffect(() => {
    if (swipeOpen) dismissSwipeHint();
  }, [swipeOpen]);

  function openSheet(focus: TransactionDetailFocus, via: "tocco" | "swipe" | "pulsante") {
    swipe.close();
    setSheetFocus(focus);
    setSheetOpen(true);
    track("transaction_detail_opened", { via, focus });
  }

  function handleFrontClick(event: React.MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
    openSheet("dettaglio", "tocco");
  }

  const amountBlock = (
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
  );

  return (
    <div className="relative overflow-hidden border-b border-border last:border-b-0">
      {/* Azioni dietro la riga (solo mobile): equivalenti a pulsanti ci sono nel dettaglio, quindi nascoste a tastiera e screen reader. */}
      <div
        className="absolute inset-y-0 left-0 flex sm:hidden"
        style={{ width: SWIPE_ACTION_WIDTH * SWIPE_LEFT_ACTIONS }}
        aria-hidden="true"
      >
        <button
          type="button"
          tabIndex={-1}
          onClick={() => openSheet("categoria", "swipe")}
          className={cn(SWIPE_BUTTON_CLASS, "w-full bg-primary text-primary-foreground")}
        >
          <TagIcon className="size-5" />
          Categoria
        </button>
      </div>
      <div
        className="absolute inset-y-0 right-0 flex sm:hidden"
        style={{ width: SWIPE_ACTION_WIDTH * SWIPE_RIGHT_ACTIONS }}
        aria-hidden="true"
      >
        <button
          type="button"
          tabIndex={-1}
          onClick={() => openSheet("dividi", "swipe")}
          className={cn(SWIPE_BUTTON_CLASS, "flex-1 bg-primary text-primary-foreground")}
        >
          <SplitIcon className="size-5" />
          Dividi
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => openSheet("dettaglio", "swipe")}
          className={cn(SWIPE_BUTTON_CLASS, "flex-1 bg-muted text-foreground")}
        >
          <ChevronRightIcon className="size-5" />
          Dettaglio
        </button>
      </div>

      <div
        {...swipe.handlers}
        onClick={handleFrontClick}
        style={{
          transform: swipe.offset === 0 ? undefined : `translateX(${swipe.offset}px)`,
          transition: swipe.dragging ? "none" : "transform 200ms ease-out",
        }}
        className={cn(
          "relative flex touch-pan-y items-center gap-2.5 bg-card px-3 py-2.5 sm:cursor-default sm:gap-3 sm:px-4 sm:py-3",
          isUncategorized && "bg-[linear-gradient(var(--neg-soft),var(--neg-soft))]",
          swipeOpen && "shadow-md"
        )}
      >
        {currentCategory && (
          <CategoryAvatar
            color={currentCategory.color as CategoryColor}
            icon={currentCategory.icon as CategoryIcon}
            size={20}
            className="size-9 shrink-0 sm:size-10"
          />
        )}

        <div className="min-w-0 flex-1 space-y-0.5">
          <button
            type="button"
            onClick={() => openSheet("dettaglio", "tocco")}
            aria-label={`${transaction.description}: apri il dettaglio`}
            className="block w-full min-w-0 text-left"
          >
            <span className="block truncate text-sm font-medium text-foreground" title={descriptionTitle}>
              {transaction.description}
            </span>
            {/* Mobile: la categoria è testo (si cambia dal dettaglio o con lo swipe); la data non serve, c'è l'intestazione del giorno. */}
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground sm:hidden">
              <span className={cn("truncate", isUncategorized && "font-semibold text-neg")}>
                {currentCategory?.name ?? "Senza categoria"}
              </span>
              {isSplit && (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary/10 px-1.5 font-semibold text-primary">
                  <SplitIcon className="size-3" aria-hidden="true" />
                  {Math.round((netAmount / fullAmount) * 100)}%
                </span>
              )}
            </span>
          </button>
          <div className="hidden min-w-0 items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <time dateTime={transaction.date} className="shrink-0 tabular-nums">
              {formatShortDate(transaction.date)}
            </time>
            <span aria-hidden="true">·</span>
            <CategoryPicker
              categories={selectableCategories}
              value={transaction.categoryId ?? ""}
              onValueChange={commitCategory}
              usage={categoryUsage}
              size="sm"
              className={cn("max-w-48 text-xs data-[size=sm]:h-7", isUncategorized && "border-neg/40 text-neg")}
            />
            {merchantKind && (
              <>
                <span aria-hidden="true">·</span>
                <span className="shrink-0 truncate" title="Tipo di esercente indicato dalla banca">
                  {merchantKind}
                </span>
              </>
            )}
            {!isAuto && (
              <Badge variant="outline" className="shrink-0">
                Manuale
              </Badge>
            )}
          </div>
          {isPending && <p className="text-xs text-muted-foreground">Salvataggio in corso...</p>}
          {isError && <p className="text-xs text-destructive">Salvataggio non riuscito, riprova.</p>}
        </div>

        {/* Colonna "Tua quota" (desktop): ha senso solo per le transazioni divise. */}
        <div className="hidden w-24 shrink-0 sm:block">
          {isSplit && (
            <>
              <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${(netAmount / fullAmount) * 100}%` }} />
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">tua quota</span>
            </>
          )}
        </div>

        {amountBlock}

        <div className="hidden shrink-0 items-center gap-1 sm:flex">
          <button
            type="button"
            onClick={() => openSheet("dividi", "pulsante")}
            aria-label={`Dividi ${transaction.description}`}
            title="Escludi una parte dell'importo dal conteggio (quote di altri, rimborsi, giroconti)"
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium",
              isSplit
                ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <SplitIcon className="size-4" aria-hidden="true" />
            Dividi
          </button>
          <button
            type="button"
            onClick={() => openSheet("dettaglio", "pulsante")}
            aria-label={`Dettaglio di ${transaction.description}`}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRightIcon className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {sheetOpen && (
        <TransactionDetailSheet
          transaction={transaction}
          categories={categories}
          currency={currency}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          focus={sheetFocus}
        />
      )}
    </div>
  );
}
