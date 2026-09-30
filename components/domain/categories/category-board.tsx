"use client";

/**
 * Board delle categorie con due viste (Compatta: colonne con chip; Dettaglio: spesa del mese per categoria), "Da categorizzare" ed Entrate. Le tessere si trascinano
 * tra le colonne per cambiare gruppo; il clic apre il dettaglio (dove il gruppo si cambia anche senza trascinare, utile su touch).
 */

import * as React from "react";
import { EXPENSE_GROUPS, GROUP_DISPLAY, groupCategoriesByType, type CategoryType } from "@/lib/categories/groups";
import type { Category } from "@/lib/db/schema/categories";
import { useCategoryUsageQuery, useUpdateCategoryMutation } from "@/lib/queries/categories";
import { SegmentedControl } from "@/components/domain/shared";
import { usePersistedFlag } from "@/lib/hooks/use-persisted-flag";
import { CategoryDetailDialog } from "./category-detail-dialog";
import { isDropTarget, type CategoryDnd } from "./category-dnd";
import { CategoryDetailView } from "./category-detail-view";
import { CategoryGroupColumn } from "./category-group-column";

export interface CategoryBoardProps {
  categories: Category[];
  /** Valuta dell'utente, usata dalla vista Dettaglio per gli importi. */
  currency: string;
}

/** Colonna della board che raccoglie i movimenti in entrata. */
const INCOME_DESCRIPTION = "Stipendio, rimborsi e tutto ciò che entra.";
const UNCATEGORIZED_DESCRIPTION = "Movimenti non ancora assegnati: si sistemano da Transazioni.";
const DETAIL_VIEW_STORAGE_KEY = "categories-detail-view";

type BoardView = "compatta" | "dettaglio";

const VIEW_OPTIONS = [
  { value: "compatta", label: "Compatta" },
  { value: "dettaglio", label: "Dettaglio" },
] as const;

export function CategoryBoard({ categories, currency }: CategoryBoardProps) {
  const { data: usage } = useCategoryUsageQuery();
  const updateMutation = useUpdateCategoryMutation();
  const sections = groupCategoriesByType(categories);

  const [detailView, setDetailView] = usePersistedFlag(DETAIL_VIEW_STORAGE_KEY, false);
  const view: BoardView = detailView ? "dettaglio" : "compatta";
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [dragged, setDragged] = React.useState<Category | null>(null);
  const [overType, setOverType] = React.useState<CategoryType | null>(null);
  const [movingId, setMovingId] = React.useState<string | null>(null);

  // Derivata dalla lista così il pannello riflette le modifiche appena salvate (e si chiude se la categoria sparisce).
  const openCategory = categories.find((category) => category.id === openId) ?? null;

  function endDrag() {
    setDragged(null);
    setOverType(null);
  }

  function handleDrop(type: CategoryType) {
    const moved = dragged;
    endDrag();
    if (!moved || moved.type === type) return;
    setMovingId(moved.id);
    updateMutation.mutate({ id: moved.id, input: { type } }, { onSettled: () => setMovingId(null) });
  }

  const dnd: CategoryDnd = {
    dragged,
    overType,
    movingId,
    onOpen: (category) => setOpenId(category.id),
    onDragStart: setDragged,
    onDragEnd: endDrag,
    onDragEnter: (type) => setOverType(type ?? null),
    onDrop: handleDrop,
  };

  function column(key: string, type: CategoryType | undefined, props: { title: string; description?: string; dotClassName?: string; items: Category[] }) {
    return (
      <CategoryGroupColumn
        key={key}
        title={props.title}
        description={props.description}
        dotClassName={props.dotClassName}
        categories={props.items}
        usage={usage}
        dropType={type}
        isDropActive={isDropTarget(dnd, type)}
        movingId={movingId}
        onOpen={dnd.onOpen}
        onDragStart={dnd.onDragStart}
        onDragEnd={dnd.onDragEnd}
        onDragEnter={() => dnd.onDragEnter(type)}
        onDrop={() => type && dnd.onDrop(type)}
      />
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <SegmentedControl<BoardView>
          ariaLabel="Vista categorie"
          options={VIEW_OPTIONS}
          value={view}
          onChange={(next) => setDetailView(next === "dettaglio")}
        />
        {view === "dettaglio" && <span className="text-sm text-muted-foreground">Spesa del mese in corso</span>}
      </div>
      {view === "dettaglio" ? (
        <CategoryDetailView categories={categories} currency={currency} dnd={dnd} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sections.groups.map((group) =>
            column(group.key, group.key, {
              title: EXPENSE_GROUPS[group.key].label,
              description: EXPENSE_GROUPS[group.key].shortDescription,
              dotClassName: EXPENSE_GROUPS[group.key].dotClassName,
              items: group.categories,
            })
          )}
          {column("entrata", "entrata", { title: "Entrate", description: INCOME_DESCRIPTION, items: sections.income })}
          {sections.uncategorized.length > 0 &&
            column("daCategorizzare", undefined, {
              title: GROUP_DISPLAY.daCategorizzare.label,
              description: UNCATEGORIZED_DESCRIPTION,
              dotClassName: GROUP_DISPLAY.daCategorizzare.dotClassName,
              items: sections.uncategorized,
            })}
        </div>
      )}
      <CategoryDetailDialog
        category={openCategory}
        usageCount={openCategory ? usage?.[openCategory.id] : undefined}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
