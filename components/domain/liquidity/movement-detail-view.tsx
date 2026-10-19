"use client";

/**
 * Everything about one transaction, as its detail shows it: amount, day and account, the category with who chose it
 * (tap «Cambia» to change it, or «Chiedi all'AI» for a second opinion), where it came from, the bank's own text, the note and the same merchant over the last
 * year. The actions under the amount (Dividi, and for those typed by hand Modifica and Elimina) come from the dialog.
 */

import * as React from "react";
import { CategoryAvatar } from "@/components/domain/categories";
import { MerchantLogo } from "@/components/domain/categorization";
import { PAGE_TITLE_FACE } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import { DialogTitle } from "@/components/ui/dialog";
import type { CategoryUsageCounts } from "@/lib/categories/picker";
import type { Category } from "@/lib/db/schema/categories";
import { localizedFormats } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";
import type { TransactionDetail } from "@/lib/queries/transactions";
import { localizedDetailText, longDateWithWeekday } from "@/lib/transactions/detail-text";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { cn } from "@/lib/utils";
import { CategorySheet } from "./category-sheet";
import { MovementDetailAi } from "./movement-detail-ai";
import { MovementDetailMerchant } from "./movement-detail-merchant";
import { MovementDetailNote } from "./movement-detail-note";
import { useTransactionCategory } from "./use-transaction-category";

export interface MovementDetailViewProps {
  detail: TransactionDetail;
  /** The row came from a list and the rest (origin, account, merchant) is still arriving. */
  partial: boolean;
  categories: readonly Category[];
  usage?: CategoryUsageCounts;
  currency: string;
  onOpenMovement: (id: string) => void;
  /** Buttons at the bottom (Dividi, Modifica, Elimina). */
  actions: React.ReactNode;
}

/** One line of the facts list: label above, value below. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-text-2">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

/** Grey bar standing in for a value that is still loading. */
function Placeholder({ className }: { className?: string }) {
  return <span className={cn("block h-5 animate-pulse rounded-full bg-muted", className)} aria-hidden="true" />;
}

export function MovementDetailView({ detail, partial, categories, usage, currency, onOpenMovement, actions }: MovementDetailViewProps) {
  const { t: tr, locale, language } = useLocalization();
  const { formatCurrency, formatDateWithYear } = localizedFormats(locale);
  const { originText, categoryOriginText } = localizedDetailText(language);
  const { transaction, account, origin, rule, merchant } = detail;
  const { selectable, choose } = useTransactionCategory(transaction, categories, "dettaglio");

  const full = Math.abs(Number(transaction.amount));
  const excluded = Math.abs(Number(transaction.excludedAmount));
  const isIncome = Number(transaction.amount) > 0;
  const category = categories.find((c) => c.id === transaction.categoryId);
  const isTransfer = category?.type === "trasferimento";
  const uncategorized = category?.isFallback ?? false;
  const isSplit = excluded > 0 && !isTransfer;
  const confidence = transaction.categoryConfidence === null ? null : Number(transaction.categoryConfidence);
  const categoryOrigin = categoryOriginText(transaction.categorySource, confidence, rule, uncategorized, transaction.bankCategory ?? null);
  const raw = transaction.rawDescription && transaction.rawDescription !== transaction.description ? transaction.rawDescription : null;
  const avatar = category ? <CategoryAvatar color={category.color as CategoryColor} icon={category.icon as CategoryIcon} size={22} className="size-14" /> : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 pr-8">
        {transaction.logoPath ? <MerchantLogo name={transaction.description} logoPath={transaction.logoPath} size="lg" fallback={avatar ?? undefined} /> : avatar}
        <div className="flex flex-col gap-1">
          <DialogTitle className={cn(PAGE_TITLE_FACE, "text-[2.25rem] font-light tracking-normal break-words")}>{transaction.description}</DialogTitle>
          <p className="text-sm text-text-2">
            {longDateWithWeekday(transaction.date, locale)}
            {account ? ` · ${account.name}` : null}
          </p>
        </div>
        <div>
          <p className={cn("font-heading text-4xl font-semibold tabular-nums", isTransfer ? "text-text-2" : isIncome ? "text-pos" : "text-neg")}>
            {isIncome ? "+" : "−"}
            {formatCurrency(isTransfer ? full : full - excluded, currency)}
          </p>
          {isSplit ? (
            <p className="mt-1 text-sm text-text-2">
              {tr("Diviso: conta la tua parte su {0}", { 0: formatCurrency(full, currency) })}
            </p>
          ) : null}
          {isTransfer ? <p className="mt-1 text-sm text-text-2">{tr("Giroconto: escluso dai conteggi")}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </header>

      <div className="flex flex-col gap-3">
        <div className={cn("flex items-center gap-3 rounded-2xl p-3.5", uncategorized ? "bg-neg-soft/60" : "bg-foreground/[0.05]")}>
          {category ? <CategoryAvatar color={category.color as CategoryColor} icon={category.icon as CategoryIcon} size={18} className="size-10" /> : null}
          <div className="min-w-0 flex-1">
            <p className={cn("font-semibold", uncategorized && "text-neg")}>{category?.name ?? tr("Senza categoria")}</p>
            {categoryOrigin ? <p className="text-sm text-text-2">{categoryOrigin}</p> : null}
          </div>
          <CategorySheet
            categories={selectable}
            value={transaction.categoryId}
            usage={usage}
            rememberLabel={uncategorized || transaction.source === "auto" ? transaction.description : undefined}
            onSelect={choose}
            trigger={<Button type="button" variant="outline" className="h-11 shrink-0 px-4">{tr("Cambia")}</Button>}
          />
        </div>
        {isTransfer ? null : (
          <MovementDetailAi key={transaction.id} transactionId={transaction.id} currentCategoryId={transaction.categoryId} categories={selectable} onUse={(categoryId) => choose(categoryId, false)} />
        )}
      </div>

      <dl className="flex flex-col gap-4">
        <Fact label={tr("Da dove arriva")}>{partial ? <Placeholder className="w-48" /> : originText(origin)}</Fact>
        {raw ? <Fact label={tr("Testo della banca")}><span className="text-sm">{raw}</span></Fact> : null}
        {transaction.merchantCategoryCode ? <Fact label={tr("Codice esercente (MCC)")}><span className="tabular-nums">{transaction.merchantCategoryCode}</span></Fact> : null}
        <Fact label={tr("Registrato il")}>{formatDateWithYear(String(transaction.createdAt).slice(0, 10))}</Fact>
      </dl>

      <MovementDetailNote key={transaction.id} transaction={transaction} />

      {merchant ? <MovementDetailMerchant summary={merchant} currency={currency} onOpen={onOpenMovement} /> : partial ? <Placeholder className="h-24 w-full rounded-2xl" /> : null}
    </div>
  );
}
