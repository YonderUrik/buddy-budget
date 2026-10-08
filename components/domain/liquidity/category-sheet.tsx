"use client";

/**
 * Scelta rapida della categoria di un movimento: si apre toccando l'icona. In cima la ricerca, poi le categorie più usate
 * come riquadri grandi, poi i gruppi di spesa. Un tocco sceglie e chiude; "Ricordala" crea la regola per i prossimi.
 */

import * as React from "react";
import { SearchIcon } from "lucide-react";
import { CategoryAvatar } from "@/components/domain/categories";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buildCategoryPickerSections, type CategoryUsageCounts } from "@/lib/categories/picker";
import type { Category } from "@/lib/db/schema/categories";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { cn } from "@/lib/utils";

/** Quante categorie compaiono come riquadri grandi nella parte alta. */
const TILE_LIMIT = 6;

export interface CategorySheetProps {
  categories: readonly Category[];
  value: string | null;
  usage?: CategoryUsageCounts;
  /** Elemento che apre il pannello (di solito l'icona del movimento). */
  trigger: React.ReactElement;
  /** Scelta fatta; `remember` dice se l'utente vuole ricordarla per i prossimi movimenti dello stesso negozio. */
  onSelect: (categoryId: string, remember: boolean) => void;
  /** Se presente, mostra l'opzione "Ricordala" con questo testo (es. nome del negozio). */
  rememberLabel?: string;
}

function CategoryTile({ category, selected, onPick }: { category: Category; selected: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className={cn(
        "flex min-h-12 min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring",
        selected ? "bg-primary/10 outline-2 outline-primary" : "bg-foreground/[0.04] hover:bg-foreground/[0.08]"
      )}
    >
      <CategoryAvatar color={category.color as CategoryColor} icon={category.icon as CategoryIcon} size={15} className="size-8" />
      <span className="min-w-0 break-words leading-tight">{category.name}</span>
    </button>
  );
}

export function CategorySheet({ categories, value, usage = {}, trigger, onSelect, rememberLabel }: CategorySheetProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [remember, setRemember] = React.useState(Boolean(rememberLabel));
  const sections = React.useMemo(() => buildCategoryPickerSections([...categories], usage, query, TILE_LIMIT), [categories, usage, query]);

  function pick(categoryId: string) {
    setOpen(false);
    if (categoryId !== value) onSelect(categoryId, remember);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setQuery("");
      }}
    >
      <PopoverTrigger render={trigger} />
      <PopoverContent align="start" className="w-[28rem] max-w-[calc(100vw-2rem)] gap-3 rounded-2xl p-4" initialFocus={(type) => (type === "touch" ? false : undefined)}>
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-input px-3">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cerca una categoria"
            aria-label="Cerca una categoria"
            className="h-11 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        <div className="max-h-80 space-y-3 overflow-y-auto">
          {sections.length === 0 && <p className="py-6 text-center text-sm text-text-2">Nessuna categoria trovata</p>}
          {sections.map((section) => (
            <div key={section.key} role="group" aria-label={section.label ?? "Categorie"}>
              {section.label && <p className="mb-1.5 text-sm font-semibold text-text-2">{section.label}</p>}
              <div className="grid grid-cols-2 gap-1.5">
                {section.categories.map((category) => (
                  <CategoryTile key={`${section.key}-${category.id}`} category={category} selected={category.id === value} onPick={() => pick(category.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
        {rememberLabel && (
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-foreground/[0.04] px-3 text-sm">
            <span>Ricordala per i prossimi «{rememberLabel}»</span>
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="size-5 accent-[var(--primary)]" />
          </label>
        )}
      </PopoverContent>
    </Popover>
  );
}
