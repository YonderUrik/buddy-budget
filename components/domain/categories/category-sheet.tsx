"use client";

/**
 * Foglio per scegliere una categoria: dal basso su mobile, finestra centrata su schermi larghi. In cima la ricerca e le
 * categorie più usate come scorciatoie, sotto tutte le altre come griglia di icone divisa per gruppo di spesa; un tocco
 * sceglie e chiude. Il chiamante passa già solo le categorie ammesse (direzione, categoria da escludere).
 */

import * as React from "react";
import { SearchIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { buildCategoryPickerSections, type CategoryUsageCounts } from "@/lib/categories/picker";
import type { Category } from "@/lib/db/schema/categories";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { CategoryAvatar } from "./category-avatar";

/** Chiave della sezione «Più usate» restituita da `buildCategoryPickerSections`. */
const MOST_USED_KEY = "most-used";

export interface CategorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  /** Utilizzi per categoria: senza, non compare la riga «Per te». */
  usage?: CategoryUsageCounts;
  title?: string;
  /** Testo sotto il titolo (es. il nome dell'esercente). */
  description?: string;
  searchPlaceholder?: string;
  onPick: (categoryId: string) => void;
  /** Contenuto fisso sotto la griglia (es. l'opzione «Usa sempre questa categoria»). */
  footer?: React.ReactNode;
}

/** Da questa larghezza (breakpoint `sm`) il foglio è una finestra e la ricerca prende subito il focus; sotto, la tastiera coprirebbe la griglia. */
const WIDE_QUERY = "(min-width: 640px)";
const EMPTY_USAGE: CategoryUsageCounts = {};

function CategoryTile({ category, onPick }: { category: Category; onPick: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(category.id)}
      className="flex min-w-0 flex-col items-center gap-1 rounded-xl p-1.5 text-center text-xs leading-tight text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CategoryAvatar color={category.color as CategoryColor} icon={category.icon as CategoryIcon} size={20} className="size-11" />
      <span className="line-clamp-2 break-words">{category.name}</span>
    </button>
  );
}

export function CategorySheet({
  open,
  onOpenChange,
  categories,
  usage = EMPTY_USAGE,
  title = "Scegli la categoria",
  description,
  searchPlaceholder = "Cerca categoria…",
  onPick,
  footer,
}: CategorySheetProps) {
  const [query, setQuery] = React.useState("");
  // Ogni apertura riparte con la ricerca vuota, anche quando il chiamante chiude il foglio cambiando `open` da sé
  // (es. la carta successiva nel mazzo di Categorizza) invece di passare da `onOpenChange`.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setQuery("");
  }
  const wide = useMediaQuery(WIDE_QUERY);
  const sections = React.useMemo(() => buildCategoryPickerSections(categories, usage, query), [categories, usage, query]);
  const firstResult = query.trim() !== "" ? sections[0]?.categories[0] : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-origin-animation="none"
        initialFocus={wide}
        className="flex h-[80dvh] flex-col gap-3 p-4 sm:h-[70vh] sm:max-w-lg"
      >
        <DialogHeader className="gap-0.5">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={description ? "truncate text-sm" : "sr-only"}>{description ?? "Cerca o scegli una categoria"}</DialogDescription>
        </DialogHeader>
        <div className="relative shrink-0">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && firstResult) {
                event.preventDefault();
                onPick(firstResult.id);
              }
            }}
            placeholder={searchPlaceholder}
            aria-label="Cerca categoria"
            className="pl-9"
          />
        </div>
        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 pb-2">
          {sections.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nessuna categoria trovata</p>
          ) : (
            sections.map((section) => (
              <section key={section.key} className="flex flex-col gap-1.5">
                {section.label && <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{section.key === MOST_USED_KEY ? "Per te" : section.label}</h3>}
                {section.key === MOST_USED_KEY ? (
                  <div className="flex flex-wrap gap-2">
                    {section.categories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => onPick(category.id)}
                        className="flex items-center gap-1.5 rounded-full bg-muted py-1 pr-3 pl-1 text-sm font-medium outline-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <CategoryAvatar color={category.color as CategoryColor} icon={category.icon as CategoryIcon} size={12} className="size-6" />
                        {category.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-1 sm:grid-cols-5">
                    {section.categories.map((category) => (
                      <CategoryTile key={category.id} category={category} onPick={onPick} />
                    ))}
                  </div>
                )}
              </section>
            ))
          )}
        </div>
        {footer ? <div className="shrink-0">{footer}</div> : null}
      </DialogContent>
    </Dialog>
  );
}
