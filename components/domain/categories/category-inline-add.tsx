"use client";
import { useLocalization } from "@/lib/localization/provider";

/** "+ Aggiungi" in fondo a una colonna: si apre in un campo nome, Invio crea la categoria nel gruppo della colonna. */

import * as React from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCreateCategoryMutation } from "@/lib/queries/categories";
import type { CategoryType } from "@/lib/categories/groups";

export interface CategoryInlineAddProps {
  type: CategoryType;
}

export function CategoryInlineAdd({ type }: CategoryInlineAddProps) {
  const { t: tr } = useLocalization();
  const createMutation = useCreateCategoryMutation();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  function close() {
    setOpen(false);
    setName("");
    setError(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed === "") return close();
    setError(null);
    createMutation.mutate(
      { name: trimmed, type },
      { onSuccess: close, onError: (mutationError) => setError(mutationError.message) }
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-10 items-center gap-1.5 rounded-full border border-dashed border-border px-3 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus size={14} aria-hidden="true" />{tr("Aggiungi")}</button>
    );
  }

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-1">
      <Input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => name.trim() === "" && close()}
        onKeyDown={(event) => event.key === "Escape" && close()}
        placeholder={tr("Nome, poi Invio")}
        aria-label={tr("Nome nuova categoria")}
        disabled={createMutation.isPending}
        className="h-9"
      />
      {error && <p className="text-xs text-destructive">{tr(error)}</p>}
    </form>
  );
}
