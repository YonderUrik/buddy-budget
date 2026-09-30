"use client";

/** Tessera grande della vista "Dettaglio": avatar, movimenti, nome, importo del periodo e barra relativa al gruppo. */

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { Category } from "@/lib/db/schema/categories";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { CategoryAvatar } from "./category-avatar";

export interface CategoryMoneyTileProps {
  category: Category;
  /** Importo del periodo (valore assoluto). */
  amount: number;
  /** Importo massimo tra le tessere del gruppo: la barra è relativa a questo. */
  maxAmount: number;
  /** Token CSS del colore della barra. */
  barColorVar: string;
  currency: string;
  usageCount?: number;
  draggable: boolean;
  isMoving?: boolean;
  onOpen: (category: Category) => void;
  onDragStart: (category: Category) => void;
  onDragEnd: () => void;
}

export function CategoryMoneyTile({
  category, amount, maxAmount, barColorVar, currency, usageCount, draggable, isMoving, onOpen, onDragStart, onDragEnd,
}: CategoryMoneyTileProps) {
  const ratio = maxAmount > 0 ? Math.max(0, Math.min(1, amount / maxAmount)) : 0;
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", category.id);
        event.dataTransfer.effectAllowed = "move";
        onDragStart(category);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(category)}
      aria-label={`Modifica ${category.name}`}
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 text-left transition-[background-color,opacity] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        draggable && "cursor-grab active:cursor-grabbing",
        isMoving && "opacity-50"
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <CategoryAvatar color={category.color as CategoryColor} icon={category.icon as CategoryIcon} className="size-9" />
        {usageCount !== undefined && usageCount > 0 && <span className="text-xs text-text-3 tabular-nums">{usageCount} mov.</span>}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground">{category.name}</span>
        <span className="block font-heading text-lg tabular-nums text-foreground">
          {formatCurrency(amount, currency, { maximumFractionDigits: 0 })}
        </span>
      </span>
      <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <span className="block h-full rounded-full" style={{ width: `${ratio * 100}%`, backgroundColor: barColorVar }} />
      </span>
    </button>
  );
}
