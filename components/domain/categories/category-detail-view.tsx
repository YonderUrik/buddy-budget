"use client";

/** Vista "Dettaglio" della board: spesa del mese per gruppo e per categoria (stile tessere con importi). */

import * as React from "react";
import { EXPENSE_GROUPS, GROUP_DISPLAY, groupCategoriesByType } from "@/lib/categories/groups";
import { sumByCategory, sumByGroup } from "@/lib/categories/spend";
import { endOfMonth, startOfDay, startOfMonth } from "@/lib/calc/expenses";
import { toDateKey } from "@/lib/calc/net-worth";
import type { Category } from "@/lib/db/schema/categories";
import { LoadError } from "@/components/domain/shared";
import { useCategoryUsageQuery } from "@/lib/queries/categories";
import { useTransactionsQuery } from "@/lib/queries/transactions";
import { CategoryDetailSection } from "./category-detail-section";
import { isDropTarget, type CategoryDnd } from "./category-dnd";
import { CategorySpendSummary } from "./category-spend-summary";

export interface CategoryDetailViewProps {
  categories: Category[];
  currency: string;
  dnd: CategoryDnd;
}

const INCOME_BAR_COLOR = "var(--pos)";

export function CategoryDetailView({ categories, currency, dnd }: CategoryDetailViewProps) {
  const today = React.useMemo(() => startOfDay(new Date()), []);
  const from = toDateKey(startOfMonth(today));
  const to = toDateKey(endOfMonth(today));
  const { data: usage } = useCategoryUsageQuery();
  const { data: transactions, isLoading, isError, refetch } = useTransactionsQuery(from, to, "tutte");

  const amounts = React.useMemo(() => sumByCategory(transactions ?? []), [transactions]);
  const groupTotals = React.useMemo(() => sumByGroup(categories, amounts), [categories, amounts]);
  const sections = groupCategoriesByType(categories);

  if (isError) return <LoadError message="Impossibile caricare la spesa del mese." onRetry={() => refetch()} />;

  const common = { amounts, usage, currency, movingId: dnd.movingId, onOpen: dnd.onOpen, onDragStart: dnd.onDragStart, onDragEnd: dnd.onDragEnd };
  return (
    <div className={isLoading ? "flex animate-pulse flex-col gap-8" : "flex flex-col gap-8"} aria-busy={isLoading}>
      <CategorySpendSummary
        currency={currency}
        items={sections.groups.map((group) => ({
          key: group.key,
          label: EXPENSE_GROUPS[group.key].label,
          colorVar: EXPENSE_GROUPS[group.key].colorVar,
          amount: groupTotals[group.key] ?? 0,
        }))}
      />
      {sections.groups.map((group) => (
        <CategoryDetailSection
          key={group.key}
          {...common}
          title={EXPENSE_GROUPS[group.key].label}
          description={EXPENSE_GROUPS[group.key].shortDescription}
          dotClassName={EXPENSE_GROUPS[group.key].dotClassName}
          barColorVar={EXPENSE_GROUPS[group.key].colorVar}
          categories={group.categories}
          groupTotal={groupTotals[group.key] ?? 0}
          dropType={group.key}
          isDropActive={isDropTarget(dnd, group.key)}
          onDragEnter={() => dnd.onDragEnter(group.key)}
          onDrop={() => dnd.onDrop(group.key)}
        />
      ))}
      <CategoryDetailSection
        {...common}
        title="Entrate"
        barColorVar={INCOME_BAR_COLOR}
        categories={sections.income}
        dropType="entrata"
        isDropActive={isDropTarget(dnd, "entrata")}
        onDragEnter={() => dnd.onDragEnter("entrata")}
        onDrop={() => dnd.onDrop("entrata")}
      />
      {sections.uncategorized.length > 0 && (
        <CategoryDetailSection
          {...common}
          title={GROUP_DISPLAY.daCategorizzare.label}
          dotClassName={GROUP_DISPLAY.daCategorizzare.dotClassName}
          barColorVar={GROUP_DISPLAY.daCategorizzare.colorVar}
          categories={sections.uncategorized}
          groupTotal={groupTotals.daCategorizzare ?? 0}
          isDropActive={false}
          onDragEnter={() => dnd.onDragEnter(undefined)}
          onDrop={() => undefined}
        />
      )}
    </div>
  );
}
