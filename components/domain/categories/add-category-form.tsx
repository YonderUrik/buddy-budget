"use client";

/** Form "+ Nuova categoria": crea una categoria con nome, tipo e icona/colore di default (personalizzabili subito dopo dalla riga). */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateCategoryMutation } from "@/lib/queries/categories";

const TYPE_LABELS: Record<"fissa" | "variabile" | "entrata", string> = {
  fissa: "Fissa",
  variabile: "Variabile",
  entrata: "Entrata",
};

export interface AddCategoryFormProps {
  /** Callback richiamata alla creazione con successo della categoria. */
  onSuccess?: () => void;
}

export function AddCategoryForm({ onSuccess }: AddCategoryFormProps) {
  const createMutation = useCreateCategoryMutation();
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<"fissa" | "variabile" | "entrata">("variabile");
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
          setType("variabile");
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
        <Select value={type} onValueChange={(value) => value && setType(value as "fissa" | "variabile" | "entrata")}>
          <SelectTrigger className="w-32">
            <SelectValue>{(value: "fissa" | "variabile" | "entrata") => TYPE_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fissa">Fissa</SelectItem>
            <SelectItem value="variabile">Variabile</SelectItem>
            <SelectItem value="entrata">Entrata</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" disabled={createMutation.isPending}>
        {createMutation.isPending ? "Aggiunta in corso..." : "Aggiungi categoria"}
      </Button>

      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}
