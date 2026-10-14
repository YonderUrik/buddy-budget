"use client";
import { useLocalization } from "@/lib/localization/provider";

/** «Aggiungi» in fondo a un gruppo del foglio «Personalizza»: si apre in un campo nome, Invio aggiunge la categoria. */

import * as React from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CATEGORY_NAME_MAX_LENGTH } from "@/lib/categories/setup";
import type { CategoryType } from "@/lib/categories/groups";

export interface CategorySetupAddProps {
  type: CategoryType;
  groupLabel: string;
  /** Restituisce il motivo se il nome non va (il campo resta aperto con il messaggio). */
  onAdd: (type: CategoryType, name: string) => string | null;
}

export function CategorySetupAdd({ type, groupLabel, onAdd }: CategorySetupAddProps) {
  const { t: tr } = useLocalization();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  function close() {
    setName("");
    setError(null);
    setOpen(false);
  }

  function commit() {
    const trimmed = name.trim();
    if (!trimmed) return close();
    const reason = onAdd(type, trimmed);
    if (reason) return setError(reason);
    close();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full cursor-pointer items-center gap-2 text-sm text-primary hover:underline"
      >
        <Plus className="size-4" aria-hidden="true" />{tr("Aggiungi in")}{" "}{groupLabel}
      </button>
    );
  }

  return (
    <div className="py-2">
      <Input
        autoFocus
        value={name}
        maxLength={CATEGORY_NAME_MAX_LENGTH}
        placeholder={tr("Nome, poi Invio")}
        aria-label={tr("Nuova categoria in {0}", {0: groupLabel})}
        onChange={(event) => setName(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") close();
        }}
        aria-invalid={Boolean(error)}
        className="h-10"
      />
      {error && <p className="mt-1 text-xs text-neg">{tr(error)}</p>}
    </div>
  );
}
