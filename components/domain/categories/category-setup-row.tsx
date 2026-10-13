"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Riga del foglio «Personalizza»: icona, nome (si tocca per rinominarlo), descrizione e interruttore. */

import * as React from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { CATEGORY_NAME_MAX_LENGTH, type CategoryProposalItem } from "@/lib/categories/setup";
import { cn } from "@/lib/utils";
import { CategoryAvatar } from "./category-avatar";

export interface CategorySetupRowProps {
  item: CategoryProposalItem;
  onToggle: (enabled: boolean) => void;
  /** Restituisce il motivo se il nome non va (resta il campo aperto con il messaggio). */
  onRename: (name: string) => string | null;
  /** Etichetta delle categorie facoltative. */
  optionalLabel?: string;
  /** Etichetta accessibile del nome da toccare. */
  renameLabel?: string;
}

export function CategorySetupRow({ item, onToggle, onRename, optionalLabel = "Facoltativa", renameLabel = "Rinomina" }: CategorySetupRowProps) {
  const { t: tr } = useLocalization();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(item.name);
  const [error, setError] = React.useState<string | null>(null);

  function close() {
    setDraft(item.name);
    setError(null);
    setEditing(false);
  }

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === item.name) return close();
    const reason = onRename(trimmed);
    if (reason) return setError(reason);
    setError(null);
    setEditing(false);
  }

  return (
    <li className="flex min-h-14 items-center gap-3 border-b border-border py-2 last:border-b-0">
      <CategoryAvatar color={item.color} icon={item.icon} className={cn("size-9 transition-opacity", !item.enabled && "opacity-45")} />
      <div className="min-w-0 flex-1">
        {editing ? (
          <Input
            autoFocus
            value={draft}
            maxLength={CATEGORY_NAME_MAX_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === "Escape") close();
            }}
            aria-label={tr("Nome di {0}", {0: item.name})}
            aria-invalid={Boolean(error)}
            className="h-10"
          />
        ) : null}
        {editing && error && <p className="mt-1 text-xs text-neg">{tr(error)}</p>}
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`${renameLabel} ${item.name}`}
            className={cn("flex w-full min-w-0 cursor-text flex-col items-start text-left", !item.enabled && "opacity-55")}
          >
            <span className="flex max-w-full items-center gap-2 text-sm font-medium text-foreground">
              <span className="truncate">{item.name}</span>
              {item.optional && (
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-normal text-primary">{optionalLabel}</span>
              )}
            </span>
            {item.description && <span className="max-w-full truncate text-xs text-text-3">{tr(item.description)}</span>}
          </button>
        )}
      </div>
      <Switch checked={item.enabled} onCheckedChange={onToggle} aria-label={tr("Usa {0}", {0: item.name})} />
    </li>
  );
}
