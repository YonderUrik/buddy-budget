"use client";

/** Budgeted categories grouped by spending group (Dovute, Volute, Te futuro, Saltuarie), then what was spent without a budget, quieter. */

import { CategoryAvatar } from "@/components/domain/categories";
import { SECTION_TITLE } from "@/components/domain/shared";
import { EXPENSE_GROUP_KEYS, GROUP_DISPLAY, UNCATEGORIZED_GROUP_KEY, type CategoryGroupKey } from "@/lib/categories/groups";
import { localizedFormats } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import type { BudgetMonthView } from "@/lib/views/budget-month";
import { BudgetCategoryRow } from "./budget-category-row";

export interface BudgetListProps {
  view: BudgetMonthView;
  onOpen: (categoryId: string) => void;
  /** A category without a budget was tapped: the caller lets the user give it one. */
  onAdd: (categoryId: string) => void;
}

const ORDER: CategoryGroupKey[] = [...EXPENSE_GROUP_KEYS, UNCATEGORIZED_GROUP_KEY];

export function BudgetList({ view, onOpen, onAdd }: BudgetListProps) {
  const { t: tr, locale } = useLocalization();
  const { formatCurrency } = localizedFormats(locale);
  const money = (n: number) => formatCurrency(n, view.currency, { maximumFractionDigits: 0 });
  const groups = ORDER.map((key) => ({ key, items: view.categories.filter((c) => c.group === key).sort((a, b) => b.available - a.available) })).filter((g) => g.items.length > 0);
  return (
    <div className="flex flex-col gap-8">
      {groups.length > 0 && (
        <section aria-label={tr("Categorie con un budget")}>
          <h2 className={SECTION_TITLE}>{tr("Categorie")}</h2>
          {groups.map((group) => (
            <div key={group.key} className="mt-4">
              <p className="px-2 text-sm text-text-3">{tr(GROUP_DISPLAY[group.key].label)}{group.key === "saltuaria" ? ` · ${tr("l'avanzo resta per i mesi dopo")}` : ""}</p>
              <ul className="mt-1 flex flex-col">
                {group.items.map((c) => (
                  <li key={c.categoryId}>
                    <BudgetCategoryRow category={c} currency={view.currency} expectedShare={view.expectedShare} onOpen={onOpen} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
      {view.unbudgeted.length > 0 && (
        <section aria-label={tr("Spese senza budget")}>
          <h2 className={SECTION_TITLE}>{tr("Senza budget")}</h2>
          <p className="mt-1 px-2 text-sm text-text-3">{tr("Tocca una categoria per darle un budget.")}</p>
          <ul className="mt-2 flex flex-col">
            {view.unbudgeted.map((c) => (
              <li key={c.categoryId}>
                <button
                  type="button"
                  onClick={() => onAdd(c.categoryId)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left text-text-2 hover:bg-foreground/[0.04] focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <CategoryAvatar color={c.color as CategoryColor} icon={c.icon as CategoryIcon} size={15} className="size-8 opacity-70" />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="font-heading tabular-nums">{money(c.spent)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
