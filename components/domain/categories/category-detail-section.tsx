"use client";

/** Sezione della vista "Dettaglio": intestazione del gruppo e griglia di tessere con importi; è anche area di rilascio del drag & drop. */

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { Category } from "@/lib/db/schema/categories";
import type { CategoryType } from "@/lib/categories/groups";
import type { CategoryUsageCounts } from "@/lib/categories/picker";
import { CategoryInlineAdd } from "./category-inline-add";
import { CategoryMoneyTile } from "./category-money-tile";

export interface CategoryDetailSectionProps {
  title: string;
  description?: string;
  dotClassName?: string;
  /** Token CSS per la barra delle tessere. */
  barColorVar: string;
  categories: Category[];
  amounts: Record<string, number>;
  usage: CategoryUsageCounts | undefined;
  currency: string;
  /** Totale del gruppo mostrato in intestazione; omesso per le entrate. */
  groupTotal?: number;
  dropType?: CategoryType;
  isDropActive: boolean;
  movingId: string | null;
  onOpen: (category: Category) => void;
  onDragStart: (category: Category) => void;
  onDragEnd: () => void;
  onDragEnter: () => void;
  onDrop: (categoryId: string) => void;
}

export function CategoryDetailSection({
  title, description, dotClassName, barColorVar, categories, amounts, usage, currency, groupTotal, dropType,
  isDropActive, movingId, onOpen, onDragStart, onDragEnd, onDragEnter, onDrop,
}: CategoryDetailSectionProps) {
  const canDrop = dropType !== undefined;
  const sorted = [...categories].sort((a, b) => (amounts[b.id] ?? 0) - (amounts[a.id] ?? 0));
  const maxAmount = Math.max(0, ...sorted.map((category) => amounts[category.id] ?? 0));
  return (
    <section
      aria-label={title}
      onDragOver={canDrop ? (event) => event.preventDefault() : undefined}
      onDragEnter={canDrop ? onDragEnter : undefined}
      onDrop={canDrop ? (event) => { event.preventDefault(); onDrop(event.dataTransfer.getData("text/plain")); } : undefined}
      className={cn("flex flex-col gap-3 rounded-xl border border-transparent p-2 -m-2 transition-colors", isDropActive && "border-primary bg-primary/5")}
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 className="flex items-center gap-2 font-heading text-lg font-medium text-foreground">
          {dotClassName && <span aria-hidden="true" className={cn("size-2.5 rounded-full", dotClassName)} />}
          {title}
        </h2>
        {groupTotal !== undefined && (
          <span className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(groupTotal, currency, { maximumFractionDigits: 0 })}</span>
        )}
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </header>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {sorted.map((category) => (
          <CategoryMoneyTile
            key={category.id}
            category={category}
            amount={amounts[category.id] ?? 0}
            maxAmount={maxAmount}
            barColorVar={barColorVar}
            currency={currency}
            usageCount={usage?.[category.id]}
            draggable={canDrop && !category.isFallback}
            isMoving={movingId === category.id}
            onOpen={onOpen}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
        {canDrop && (
          <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-border p-3">
            <CategoryInlineAdd type={dropType} />
          </div>
        )}
      </div>
    </section>
  );
}
