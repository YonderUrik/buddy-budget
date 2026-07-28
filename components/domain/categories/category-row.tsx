"use client";

/**
 * Riga singola nella pagina Categorie. Nome, tipo, icona e colore sono editabili
 * inline (salvataggio on-blur/on-change). L'eliminazione è bloccata (bottone
 * disabilitato con tooltip) per la categoria fallback "Da categorizzare".
 */

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { useDeleteCategoryMutation, useUpdateCategoryMutation } from "@/lib/queries/categories";
import type { Category } from "@/lib/db/schema/categories";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { CategoryAvatar } from "./category-avatar";
import { CategoryIconColorPicker } from "./category-icon-color-picker";

const TYPE_LABELS: Record<"fissa" | "variabile" | "entrata", string> = {
  fissa: "Fissa",
  variabile: "Variabile",
  entrata: "Entrata",
};

export interface CategoryRowProps {
  category: Category;
}

export function CategoryRow({ category }: CategoryRowProps) {
  const updateMutation = useUpdateCategoryMutation();
  const deleteMutation = useDeleteCategoryMutation();

  const [name, setName] = React.useState(category.name);
  const [confirmDialogOpen, setConfirmDialogOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function commitName() {
    if (name.trim() === "" || name === category.name) {
      setName(category.name);
      return;
    }
    setError(null);
    updateMutation.mutate(
      { id: category.id, input: { name: name.trim() } },
      {
        onError: (mutationError) => {
          setError(mutationError.message);
          setName(category.name);
        },
      }
    );
  }

  function commitType(type: string | null) {
    if (type === null || type === category.type) return;
    updateMutation.mutate({ id: category.id, input: { type: type as "fissa" | "variabile" | "entrata" } });
  }

  function handleAppearanceChange(next: { color: CategoryColor; icon: CategoryIcon }) {
    if (next.color !== category.color) {
      updateMutation.mutate({ id: category.id, input: { color: next.color } });
    }
    if (next.icon !== category.icon) {
      updateMutation.mutate({ id: category.id, input: { icon: next.icon } });
    }
  }

  function handleDeleteConfirm() {
    deleteMutation.mutate(category.id, {
      onSuccess: () => setConfirmDialogOpen(false),
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <CategoryIconColorPicker
          value={{ color: category.color as CategoryColor, icon: category.icon as CategoryIcon }}
          onChange={handleAppearanceChange}
        >
          <CategoryAvatar color={category.color as CategoryColor} icon={category.icon as CategoryIcon} />
        </CategoryIconColorPicker>

        <div className="min-w-0 flex-1 space-y-1">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            className="h-7 w-full text-sm font-medium"
            aria-label="Nome categoria"
          />
          <Select value={category.type} onValueChange={commitType}>
            <SelectTrigger size="sm" className="h-6 w-fit text-xs">
              <SelectValue>
                {(value: "fissa" | "variabile" | "entrata") => TYPE_LABELS[value]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fissa">Fissa</SelectItem>
              <SelectItem value="variabile">Variabile</SelectItem>
              <SelectItem value="entrata">Entrata</SelectItem>
            </SelectContent>
          </Select>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {category.isFallback && (
          <Badge variant="secondary" className="text-[10px]">
            Fallback
          </Badge>
        )}

        <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <AlertDialogTrigger
            disabled={category.isFallback}
            title={category.isFallback ? "La categoria di fallback non può essere eliminata" : undefined}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
            aria-label="Elimina categoria"
          >
            <Trash2 size={14} />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminare questa categoria?</AlertDialogTitle>
              <AlertDialogDescription>
                &quot;{category.name}&quot; verrà eliminata. Le transazioni collegate saranno riassegnate a
                &quot;Da categorizzare&quot; e il budget associato verrà rimosso.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteMutation.isError && (
              <p className="text-sm text-destructive">Eliminazione non riuscita, riprova.</p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? "Eliminazione..." : "Elimina"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
