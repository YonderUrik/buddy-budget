"use client";

/** Tessera di una categoria nella board: avatar, nome e utilizzo; apre il dettaglio al clic ed è trascinabile tra i gruppi. */

import { cn } from "@/lib/utils";
import type { Category } from "@/lib/db/schema/categories";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { CategoryAvatar } from "./category-avatar";

export interface CategoryTileProps {
  category: Category;
  /** Transazioni recenti della categoria; omesso mentre il dato carica. */
  usageCount?: number;
  /** Trascinabile solo se la categoria può cambiare gruppo (non la fallback). */
  draggable: boolean;
  isMoving?: boolean;
  onOpen: (category: Category) => void;
  onDragStart: (category: Category) => void;
  onDragEnd: () => void;
}

export function CategoryTile({ category, usageCount, draggable, isMoving, onOpen, onDragStart, onDragEnd }: CategoryTileProps) {
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
        "group flex min-h-10 max-w-full items-center gap-2 rounded-full border border-border bg-card py-1 pr-3 pl-1 text-left text-sm transition-[background-color,box-shadow,opacity] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        draggable && "cursor-grab active:cursor-grabbing",
        isMoving && "opacity-50"
      )}
    >
      <CategoryAvatar color={category.color as CategoryColor} icon={category.icon as CategoryIcon} className="size-7" size={14} />
      <span className="min-w-0 truncate font-medium text-foreground">{category.name}</span>
      {usageCount !== undefined && usageCount > 0 && (
        <span className="shrink-0 text-xs text-text-3 tabular-nums">{usageCount}</span>
      )}
    </button>
  );
}
