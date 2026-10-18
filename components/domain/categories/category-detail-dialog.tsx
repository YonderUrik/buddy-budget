"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Detail window of a category: name, description, group, monthly budget (expense groups only), colour and icon
 * (saved immediately or on blur) and deletion with confirmation. The "Da categorizzare" fallback cannot be renamed,
 * moved, budgeted or deleted.
 */

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SegmentedControl, FormDialogContent } from "@/components/domain/shared";
import { useDeleteCategoryMutation, useUpdateCategoryMutation } from "@/lib/queries/categories";
import { CATEGORY_TYPES, CATEGORY_TYPE_LABELS, EXPENSE_GROUP_KEYS, type CategoryType } from "@/lib/categories/groups";
import type { Category } from "@/lib/db/schema/categories";
import { CATEGORY_DESCRIPTION_MAX_LENGTH, type CategoryColor, type CategoryIcon } from "@/lib/validation/categories";
import { CategoryAppearanceFields } from "./category-appearance-fields";
import { CategoryAvatar } from "./category-avatar";
import { CategoryBudgetField } from "./category-budget-field";

const DESCRIPTION_PLACEHOLDER = "Es. supermercato, alimentari";
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
      <FormDialogContent>
        {category && <DetailBody key={category.id} category={category} usageCount={usageCount} onClose={onClose} />}
      </FormDialogContent>
    </Dialog>
  );
}

function DetailBody({ category, usageCount, onClose }: { category: Category; usageCount?: number; onClose: () => void }) {
  const { t: tr } = useLocalization();
  const updateMutation = useUpdateCategoryMutation();
  const deleteMutation = useDeleteCategoryMutation();
  const [name, setName] = React.useState(category.name);
  const [description, setDescription] = React.useState(category.description ?? "");
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

  function commitDescription() {
    const trimmed = description.trim();
    if (trimmed === (category.description ?? "")) return setDescription(trimmed);
    updateMutation.mutate({ id: category.id, input: { description: trimmed } });
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
              {usageCount ? tr("{0} transazioni nell'ultimo anno", {0: usageCount}) : tr("Nessuna transazione nell'ultimo anno")}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="category-name" className="text-xs font-medium text-muted-foreground">{tr("Nome")}</label>
          <Input
            id="category-name"
            value={name}
            disabled={category.isFallback}
            onChange={(event) => setName(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
          />
          {error && <p className="text-xs text-destructive">{tr(error)}</p>}
        </div>

        {!category.isFallback && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="category-description" className="text-xs font-medium text-muted-foreground">{tr("Cosa ci va (facoltativo)")}</label>
            <Input
              id="category-description"
              value={description}
              maxLength={CATEGORY_DESCRIPTION_MAX_LENGTH}
              placeholder={tr(DESCRIPTION_PLACEHOLDER)}
              onChange={(event) => setDescription(event.target.value)}
              onBlur={commitDescription}
              onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
            />
            <p className="text-xs text-text-3">{tr("Aiuta l'assistente a proporre questa categoria agli esercenti giusti.")}</p>
          </div>
        )}

        {!category.isFallback && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{tr("Gruppo")}</span>
            <SegmentedControl<CategoryType>
              ariaLabel={tr("Gruppo della categoria")}
              options={TYPE_OPTIONS}
              value={category.type as CategoryType}
              onChange={(type) => type !== category.type && updateMutation.mutate({ id: category.id, input: { type } })}
              className="flex-wrap"
            />
          </div>
        )}

        {!category.isFallback && (EXPENSE_GROUP_KEYS as readonly string[]).includes(category.type) && (
          <CategoryBudgetField categoryId={category.id} categoryName={category.name} />
        )}

        <CategoryAppearanceFields value={{ color, icon }} onChange={commitAppearance} />
      </div>

      {!category.isFallback && (
        <div className="border-t border-border pt-4">
          {confirmingDelete ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{tr("Le transazioni collegate passeranno a \"Da categorizzare\" e il budget associato verrà rimosso.")}</p>
              {deleteMutation.isError && <p className="text-sm text-destructive">{tr("Eliminazione non riuscita, riprova.")}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmingDelete(false)}>{tr("Annulla")}</Button>
                <Button
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(category.id, { onSuccess: onClose })}
                >
                  {deleteMutation.isPending ? tr("Eliminazione...") : tr("Elimina categoria")}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmingDelete(true)}>
              <Trash2 size={14} />{tr("Elimina categoria")}</Button>
          )}
        </div>
      )}
    </>
  );
}
