"use client";

/** Form "+ Nuova categoria": crea una categoria con nome, tipo e icona/colore di default (personalizzabili subito dopo dalla riga). */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateCategoryMutation } from "@/lib/queries/categories";
import { DEFAULT_NEW_CATEGORY_TYPE, type CategoryType } from "@/lib/categories/groups";
import { CategoryTypeSelect } from "./category-type-select";

export interface AddCategoryFormProps {
  /** Callback richiamata alla creazione con successo della categoria. */
  onSuccess?: () => void;
}

export function AddCategoryForm({ onSuccess }: AddCategoryFormProps) {
  const createMutation = useCreateCategoryMutation();
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<CategoryType>(DEFAULT_NEW_CATEGORY_TYPE);
  const [error, setError] = React.useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (name.trim() === "") {
      setError("Il nome è obbligatorio");
      return;
    }

    createMutation.mutate(
      { name: name.trim(), type },
      {
        onSuccess: () => {
          setName("");
          setType(DEFAULT_NEW_CATEGORY_TYPE);
          onSuccess?.();
        },
        onError: (mutationError) => setError(mutationError.message),
      }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 border-t border-border p-4">
      <div className="flex flex-1 flex-col gap-1">
        <label className="text-xs font-medium text-foreground" htmlFor="new-category-name">
          Nome
        </label>
        <Input
          id="new-category-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Es. Palestra"
          className="w-full"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground">Tipo</label>
        <CategoryTypeSelect value={type} onChange={setType} className="w-36" />
      </div>

      <Button type="submit" disabled={createMutation.isPending}>
        {createMutation.isPending ? "Aggiunta in corso..." : "Aggiungi categoria"}
      </Button>

      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}
