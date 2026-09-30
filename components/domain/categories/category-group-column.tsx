"use client";

/** Colonna della board: intestazione del gruppo, tessere delle sue categorie e area di rilascio per il drag & drop. */

import { cn } from "@/lib/utils";
import type { Category } from "@/lib/db/schema/categories";
import type { CategoryType } from "@/lib/categories/groups";
import type { CategoryUsageCounts } from "@/lib/categories/picker";
import { CategoryInlineAdd } from "./category-inline-add";
import { CategoryTile } from "./category-tile";

export interface CategoryGroupColumnProps {
  title: string;
  description?: string;
  /** Classe Tailwind del pallino colore del gruppo. */
  dotClassName?: string;
  categories: Category[];
  usage: CategoryUsageCounts | undefined;
  /** Tipo assegnato dal drop e dal "+ Aggiungi"; assente per la colonna "Da categorizzare" (non accetta né crea). */
  dropType?: CategoryType;
  isDropActive: boolean;
  movingId: string | null;
  onOpen: (category: Category) => void;
  onDragStart: (category: Category) => void;
  onDragEnd: () => void;
  onDragEnter: () => void;
  onDrop: (categoryId: string) => void;
}

export function CategoryGroupColumn({
  title, description, dotClassName, categories, usage, dropType, isDropActive, movingId,
  onOpen, onDragStart, onDragEnd, onDragEnter, onDrop,
}: CategoryGroupColumnProps) {
  const canDrop = dropType !== undefined;
  return (
    <section
      aria-label={title}
      onDragOver={canDrop ? (event) => event.preventDefault() : undefined}
      onDragEnter={canDrop ? onDragEnter : undefined}
      onDrop={canDrop ? (event) => { event.preventDefault(); onDrop(event.dataTransfer.getData("text/plain")); } : undefined}
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4 transition-colors",
        isDropActive && "border-primary bg-primary/5"
      )}
    >
      <header className="flex flex-col gap-0.5">
        <h2 className="flex items-center gap-2 font-heading text-base font-medium text-foreground">
          {dotClassName && <span aria-hidden="true" className={cn("size-2.5 rounded-full", dotClassName)} />}
          {title}
          <span className="text-xs font-normal text-text-3 tabular-nums">{categories.length}</span>
        </h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </header>
      <div className="flex flex-wrap items-center gap-2">
        {categories.map((category) => (
          <CategoryTile
            key={category.id}
            category={category}
            usageCount={usage?.[category.id]}
            draggable={canDrop && !category.isFallback}
            isMoving={movingId === category.id}
            onOpen={onOpen}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
        {canDrop && <CategoryInlineAdd type={dropType} />}
      </div>
    </section>
  );
}
