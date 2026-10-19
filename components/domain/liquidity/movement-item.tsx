"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Un movimento con i suoi comportamenti: cambio categoria dall'icona, Dividi, nota e (per i manuali) modifica ed elimina.
 * Se c'è il logo dell'esercente prende il posto dell'icona, che resta piccola nell'angolo (si tocca sempre lì per cambiarla).
 */

import * as React from "react";
import { PencilIcon, SplitIcon, Trash2Icon } from "lucide-react";
import { CategoryAvatar } from "@/components/domain/categories";
import { AutoOriginBadge, MerchantLogo } from "@/components/domain/categorization";
import { TransactionEditPanel, TransactionNotePopover } from "@/components/domain/expenses";
import { InlineOrSheet } from "@/components/domain/shared";
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
import type { CategoryUsageCounts } from "@/lib/categories/picker";
import type { Category } from "@/lib/db/schema/categories";
import { useDeleteTransactionMutation, type ListedTransaction } from "@/lib/queries/transactions";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { cn } from "@/lib/utils";
import { CategorySheet } from "./category-sheet";
import { MovementRow } from "./movement-row";
import { SplitPanel } from "./split-panel";
import { useTransactionCategory } from "./use-transaction-category";

export interface MovementItemProps {
  /** Il movimento, con `logoPath` se il server ha trovato il logo dell'esercente. */
  transaction: ListedTransaction;
  categories: readonly Category[];
  usage?: CategoryUsageCounts;
  accountName?: string;
  currency: string;
  /** Chiamata quando la riga mostra il logo dell'esercente (per citare la fonte dei loghi sotto l'elenco). */
  onRemoteLogo?: () => void;
  /** Opens the transaction's detail (tap on the row). */
  onOpen?: () => void;
}

type Panel = "none" | "split" | "edit";

/** Icona della categoria alla misura richiesta. */
function categoryAvatar(category: Category, className: string, iconSize: number) {
  return <CategoryAvatar color={category.color as CategoryColor} icon={category.icon as CategoryIcon} size={iconSize} className={className} />;
}

export function MovementItem({ transaction, categories, usage, accountName, currency, onRemoteLogo, onOpen }: MovementItemProps) {
  const { t: tr } = useLocalization();
  const remove = useDeleteTransactionMutation();
  const { selectable, choose: chooseCategory, update, autoSource } = useTransactionCategory(transaction, categories);
  const [panel, setPanel] = React.useState<Panel>("none");
  const [actionsOpen, setActionsOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [logoShown, setLogoShown] = React.useState(false);

  const full = Math.abs(Number(transaction.amount));
  const excluded = Math.abs(Number(transaction.excludedAmount));
  const isIncome = Number(transaction.amount) > 0;
  const isAuto = transaction.source === "auto";
  const category = categories.find((c) => c.id === transaction.categoryId);
  const uncategorized = category?.isFallback ?? false;
  const hasRaw = transaction.rawDescription && transaction.rawDescription !== transaction.description;
  // Category set by the app (rule, past choices, AI): said next to the name, so the user knows what to check.
  const autoConfidence = transaction.categoryConfidence === null ? null : Number(transaction.categoryConfidence);

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
          aria-label={tr("Categoria: {0}. Tocca per cambiarla", {0: category.name})}
          className="relative size-11 shrink-0 rounded-full transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {transaction.logoPath ? (
            <MerchantLogo
              name={transaction.description}
              logoPath={transaction.logoPath}
              fallback={categoryAvatar(category, "size-11", 19)}
              onRemoteLogo={() => {
                setLogoShown(true);
                onRemoteLogo?.();
              }}
            />
          ) : (
            categoryAvatar(category, "size-11", 19)
          )}
          {logoShown && transaction.logoPath ? (
            <span className="absolute -right-1 -bottom-1 rounded-full bg-background p-px">{categoryAvatar(category, "size-5", 11)}</span>
          ) : null}
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
        categoryOrigin={autoSource && !uncategorized ? <AutoOriginBadge source={autoSource} confidence={autoConfidence} bankCategory={transaction.bankCategory} compact className="align-[-0.15em]" /> : undefined}
        uncategorized={uncategorized}
        accountName={accountName}
        amount={full - excluded}
        fullAmount={full}
        excluded={excluded}
        isIncome={isIncome}
        isTransfer={category?.type === "trasferimento"}
        currency={currency}
        avatar={avatar}
        splitOpen={panel === "split"}
        onSplit={() => setPanel((p) => (p === "split" ? "none" : "split"))}
        actionsOpen={actionsOpen}
        actionsId={`azioni-${transaction.id}`}
        onToggleActions={() => setActionsOpen((o) => !o)}
        onOpen={onOpen}
        statusMessage={update.isPending ? "Salvataggio…" : update.isError ? "Salvataggio non riuscito, riprova." : undefined}
      />
      {actionsOpen && (
        <div id={`azioni-${transaction.id}`} className="flex flex-wrap items-center gap-1 px-2 pb-2">
          {category?.type !== "trasferimento" && <button type="button" className={cn(actionButton, "sm:hidden")} onClick={() => setPanel("split")}>
            <SplitIcon className="size-4" aria-hidden="true" />{" "}{tr("Dividi")}</button>}
          <TransactionNotePopover transaction={transaction} />
          {!isAuto && (
            <>
              <button type="button" className={actionButton} onClick={() => setPanel((p) => (p === "edit" ? "none" : "edit"))}>
                <PencilIcon className="size-4" aria-hidden="true" />{" "}{tr("Modifica")}</button>
              <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogTrigger className={cn(actionButton, "hover:bg-destructive/10 hover:text-destructive")}>
                  <Trash2Icon className="size-4" aria-hidden="true" />{" "}{tr("Elimina")}</AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{tr("Eliminare questo movimento?")}</AlertDialogTitle>
                    <AlertDialogDescription>{"«"}{transaction.description}{tr("» verrà eliminato definitivamente.")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{tr("Annulla")}</AlertDialogCancel>
                    <AlertDialogAction disabled={remove.isPending} onClick={() => remove.mutate(transaction.id, { onSuccess: () => setConfirmOpen(false) })}>
                      {remove.isPending ? tr("Eliminazione…") : tr("Elimina")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      )}
      <InlineOrSheet open={panel === "split"} onOpenChange={(open) => !open && setPanel("none")} title={tr("Dividi {0}", {0: transaction.description})}>
        {(layout) => (
          <SplitPanel
            title={transaction.description}
            total={full}
            excluded={excluded}
            currency={currency}
            isIncome={isIncome}
            saving={update.isPending}
            onSave={saveSplit}
            onCancel={() => setPanel("none")}
            className={layout === "sheet" ? "m-0 bg-transparent p-0" : undefined}
          />
        )}
      </InlineOrSheet>
      <InlineOrSheet open={panel === "edit"} onOpenChange={(open) => !open && setPanel("none")} title={tr("Modifica movimento")} showTitle>
        {(layout) => (
          <TransactionEditPanel
            transaction={transaction}
            currency={currency}
            onClose={() => setPanel("none")}
            className={layout === "sheet" ? "border-0 bg-transparent p-0" : undefined}
          />
        )}
      </InlineOrSheet>
    </li>
  );
}
