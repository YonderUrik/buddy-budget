"use client";

/** One budgeted category in Liquidità · Budget: spent, the bar, what is left (or how much over) and, when it helps, the leftover carried in and where the month is heading. */

import { CategoryAvatar } from "@/components/domain/categories";
import { localizedFormats } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import type { BudgetMonthView } from "@/lib/views/budget-month";
import { BudgetBar } from "./budget-bar";

export type BudgetCategory = BudgetMonthView["categories"][number];

export interface BudgetCategoryRowProps {
  category: BudgetCategory;
  currency: string;
  /** Share of the month gone by; null for past months. */
  expectedShare: number | null;
  onOpen: (categoryId: string) => void;
}

export function BudgetCategoryRow({ category: c, currency, expectedShare, onOpen }: BudgetCategoryRowProps) {
  const { t: tr, locale } = useLocalization();
  const { formatCurrency } = localizedFormats(locale);
  const money = (n: number) => formatCurrency(n, currency, { maximumFractionDigits: 0 });
  const over = c.left < 0;
  const heading = c.projected !== null && !over && c.projected > c.available + 0.5;
  const note = over
    ? tr("{0} oltre i {1} del mese", { 0: money(-c.left), 1: money(c.available) })
    : heading
      ? tr("restano {0} · a questo ritmo arrivi a {1}", { 0: money(c.left), 1: money(c.projected!) })
      : tr("restano {0} su {1}", { 0: money(c.left), 1: money(c.available) });
  return (
    <button
      type="button"
      onClick={() => onOpen(c.categoryId)}
      className="flex w-full items-start gap-3 rounded-2xl px-2 py-3 text-left hover:bg-foreground/[0.04] focus-visible:outline-2 focus-visible:outline-ring"
    >
      <CategoryAvatar color={c.color as CategoryColor} icon={c.icon as CategoryIcon} size={16} className="mt-0.5 size-9" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate font-medium">{c.name}</span>
          <span className="font-heading font-semibold tabular-nums">{money(c.spent)}</span>
        </span>
        <BudgetBar
          className="mt-2"
          spent={c.spent}
          available={c.available}
          expectedShare={c.group === "saltuaria" ? null : expectedShare}
          label={tr("Budget usato: {0}% di {1}", { 0: c.available > 0 ? Math.round((c.spent / c.available) * 100) : 100, 1: money(c.available) })}
        />
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className={cn(over || heading ? "text-neg" : "text-text-2")}>{note}</span>
          {c.carried > 0.5 && <span className="rounded-full bg-pos-soft px-2 py-0.5 text-xs text-pos">{tr("+{0} messi da parte", { 0: money(c.carried) })}</span>}
          {c.carried < -0.5 && <span className="rounded-full bg-neg-soft px-2 py-0.5 text-xs text-neg">{tr("−{0} dai mesi prima", { 0: money(-c.carried) })}</span>}
          {c.singleMonth && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-text-2">{tr("cifra solo per questo mese")}</span>}
        </span>
      </span>
    </button>
  );
}
