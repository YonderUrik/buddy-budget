"use client";

/**
 * Pannello di dettaglio di una categoria: nome, gruppo, colore e icona (salvataggio immediato/on-blur)
 * ed eliminazione con conferma. La fallback "Da categorizzare" non si rinomina, non cambia gruppo e non si elimina.
 */

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/domain/shared";
import { useDeleteCategoryMutation, useUpdateCategoryMutation } from "@/lib/queries/categories";
import { CATEGORY_TYPES, CATEGORY_TYPE_LABELS, type CategoryType } from "@/lib/categories/groups";
import type { Category } from "@/lib/db/schema/categories";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { CategoryAppearanceFields } from "./category-appearance-fields";
import { CategoryAvatar } from "./category-avatar";

const TYPE_OPTIONS = CATEGORY_TYPES.map((type) => ({ value: type, label: CATEGORY_TYPE_LABELS[type] }));

export interface CategoryDetailDialogProps {
  /** Categoria aperta; `null` chiude il pannello. */
  category: Category | null;
  /** Transazioni recenti della categoria, mostrate come contesto prima di eliminarla. */
  usageCount?: number;
  onClose: () => void;
}

export function CategoryDetailDialog({ category, usageCount, onClose }: CategoryDetailDialogProps) {
  return (
    <Dialog open={category !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {category && <DetailBody key={category.id} category={category} usageCount={usageCount} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function DetailBody({ category, usageCount, onClose }: { category: Category; usageCount?: number; onClose: () => void }) {
  const updateMutation = useUpdateCategoryMutation();
  const deleteMutation = useDeleteCategoryMutation();
  const [name, setName] = React.useState(category.name);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);

  const color = category.color as CategoryColor;
  const icon = category.icon as CategoryIcon;

  function commitName() {
    const trimmed = name.trim();
    if (trimmed === "" || trimmed === category.name) return setName(category.name);
    setError(null);
    updateMutation.mutate(
      { id: category.id, input: { name: trimmed } },
      { onError: (mutationError) => { setError(mutationError.message); setName(category.name); } }
    );
  }

  function commitAppearance(next: { color: CategoryColor; icon: CategoryIcon }) {
    if (next.color !== color) updateMutation.mutate({ id: category.id, input: { color: next.color } });
    if (next.icon !== icon) updateMutation.mutate({ id: category.id, input: { icon: next.icon } });
  }

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <CategoryAvatar color={color} icon={icon} className="size-11" size={20} />
          <div className="min-w-0">
            <DialogTitle className="truncate font-heading text-lg font-medium">{category.name}</DialogTitle>
            <DialogDescription>
              {usageCount ? `${usageCount} transazioni nell'ultimo anno` : "Nessuna transazione nell'ultimo anno"}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="category-name" className="text-xs font-medium text-muted-foreground">Nome</label>
          <Input
            id="category-name"
            value={name}
            disabled={category.isFallback}
            onChange={(event) => setName(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        {!category.isFallback && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Gruppo</span>
            <SegmentedControl<CategoryType>
              ariaLabel="Gruppo della categoria"
              options={TYPE_OPTIONS}
              value={category.type as CategoryType}
              onChange={(type) => type !== category.type && updateMutation.mutate({ id: category.id, input: { type } })}
              className="flex-wrap"
            />
          </div>
        )}

        <CategoryAppearanceFields value={{ color, icon }} onChange={commitAppearance} />
      </div>

      {!category.isFallback && (
        <div className="border-t border-border pt-4">
          {confirmingDelete ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Le transazioni collegate passeranno a &quot;Da categorizzare&quot; e il budget associato verrà rimosso.
              </p>
              {deleteMutation.isError && <p className="text-sm text-destructive">Eliminazione non riuscita, riprova.</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmingDelete(false)}>Annulla</Button>
                <Button
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(category.id, { onSuccess: onClose })}
                >
                  {deleteMutation.isPending ? "Eliminazione..." : "Elimina categoria"}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmingDelete(true)}>
              <Trash2 size={14} />
              Elimina categoria
            </Button>
          )}
        </div>
      )}
    </>
  );
}
