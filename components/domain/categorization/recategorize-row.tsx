"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Riga dell'anteprima di «Ricategorizza»: un esercente, quanti movimenti e quando, da quale categoria a quale e perché
 * (regola, le tue scelte, AI). La casella dice se il gruppo verrà spostato. Non scrive nulla.
 */

import * as React from "react";
import { ArrowRightIcon } from "lucide-react";
import { CategoryAvatar } from "@/components/domain/categories";
import { Checkbox } from "@/components/ui/checkbox";
import { localizedCategorizationText } from "@/lib/categorization/origin";
import type { RecategorizePreviewGroup } from "@/lib/categorization/recategorize-plan";
import type { Category } from "@/lib/db/schema/categories";
import { localizedFormats } from "@/lib/localization/format";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { cn } from "@/lib/utils";
import { MerchantLogo } from "./merchant-logo";
import { AutoOriginBadge } from "./suggestion-origin";

export interface RecategorizeRowProps {
  group: RecategorizePreviewGroup;
  categoryById: ReadonlyMap<string, Category>;
  currency: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onRemoteLogo?: () => void;
}

/** Categoria come chip piccola: icona e nome (quella di partenza più tenue). */
function CategoryChip({ category, muted = false }: { category: Category | undefined; muted?: boolean }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-sm", muted ? "text-muted-foreground" : "font-medium text-foreground")}>
      {category ? <CategoryAvatar icon={category.icon as CategoryIcon} color={category.color as CategoryColor} size={11} className={cn("size-5", muted && "opacity-60")} /> : null}
      <span className={cn("truncate", muted && "line-through decoration-foreground/30")}>{category?.name ?? "Categoria"}</span>
    </span>
  );
}

/** I movimenti categorizzati prima che l'app ne segnasse l'origine: potrebbero essere scelte dell'utente. */
function maybeMineText(legacyCount: number, count: number): string {
  if (legacyCount === count) return count === 1 ? "forse scelto da te" : "forse scelti da te";
  return `${legacyCount} forse scelti da te`;
}

export function RecategorizeRow({ group, categoryById, currency, checked, onCheckedChange, onRemoteLogo }: RecategorizeRowProps) {
  const { dateRangeLabel } = localizedCategorizationText(useLocalization().language);

  const { t: tr, locale } = useLocalization();
  const { formatCurrency } = localizedFormats(locale);
  const checkboxId = React.useId();
  const isIncome = group.totalAmount > 0;
  return (
    <li className={cn("flex gap-3 py-3 transition-opacity", !checked && "opacity-55")}>
      <Checkbox id={checkboxId} checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} className="mt-3" aria-label={tr("Sposta {0}", {0: group.label})} />
      <MerchantLogo name={group.label} logoPath={group.logoPath} size="sm" onRemoteLogo={onRemoteLogo} />
      <label htmlFor={checkboxId} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1.5">
        <span className="flex items-start justify-between gap-3">
          <span className="flex min-w-0 flex-col">
            <span className="line-clamp-2 text-sm font-medium break-words text-foreground">{tr(group.label)}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {group.count === 1 ? tr("1 movimento") : tr("{0} movimenti", {0: group.count})} {"·"}{dateRangeLabel([group.firstDate, group.lastDate])}
              {group.legacyCount > 0 ? ` · ${maybeMineText(group.legacyCount, group.count)}` : ""}
            </span>
          </span>
          <span className={cn("shrink-0 text-sm font-medium tabular-nums", isIncome ? "text-pos" : "text-foreground")}>
            {formatCurrency(group.totalAmount, currency)}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <CategoryChip category={categoryById.get(group.fromCategoryId)} muted />
          <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground" aria-label={tr("diventa")} />
          <CategoryChip category={categoryById.get(group.toCategoryId)} />
          <AutoOriginBadge source={group.source} confidence={group.confidence} className="ml-auto" />
        </span>
      </label>
    </li>
  );
}
