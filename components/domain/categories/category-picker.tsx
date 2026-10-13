"use client";

/**
 * Selettore categoria con ricerca: in cima le più usate, poi le categorie divise per gruppo di spesa;
 * digitando filtra per nome (accenti ignorati) o per gruppo. Navigabile da tastiera (frecce + Invio).
 * Il chiamante passa già solo le categorie ammesse (es. filtrate per direzione entrata/uscita).
 */

import * as React from "react";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buildCategoryPickerSections, type CategoryUsageCounts } from "@/lib/categories/picker";
import type { Category } from "@/lib/db/schema/categories";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { CategoryAvatar } from "./category-avatar";

export interface CategoryPickerProps {
  categories: Category[];
  /** Id della categoria selezionata; stringa vuota = nessuna scelta. */
  value: string;
  onValueChange: (categoryId: string) => void;
  /** Utilizzi per categoria (vedi `useCategoryUsageQuery`): senza, la sezione "Più usate" non compare. */
  usage?: CategoryUsageCounts;
  size?: "sm" | "default";
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  "aria-label"?: string;
  className?: string;
}

const EMPTY_USAGE: CategoryUsageCounts = {};

function CategoryLabel({ category }: { category: Category }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <CategoryAvatar
        color={category.color as CategoryColor}
        icon={category.icon as CategoryIcon}
        size={10}
        className="size-4 shrink-0"
      />
      <span className="truncate" title={category.name}>
        {category.name}
      </span>
    </span>
  );
}

export function CategoryPicker({
  categories,
  value,
  onValueChange,
  usage = EMPTY_USAGE,
  size = "default",
  disabled = false,
  placeholder = "Scegli una categoria",
  searchPlaceholder = "Cerca categoria…",
  emptyMessage = "Nessuna categoria trovata",
  "aria-label": ariaLabel = "Categoria",
  className,
}: CategoryPickerProps) {
  const listboxId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);

  const selected = categories.find((c) => c.id === value);
  const sections = React.useMemo(
    () => buildCategoryPickerSections(categories, usage, query),
    [categories, usage, query]
  );
  // Lista piatta delle opzioni navigabili: una categoria può comparire due volte ("Più usate" + suo gruppo).
  const options = React.useMemo(() => sections.flatMap((section) => section.categories), [sections]);
  // Indice (nella lista piatta) della prima opzione di ogni sezione.
  const sectionOffsets = React.useMemo(
    () => sections.map((_, i) => sections.slice(0, i).reduce((sum, section) => sum + section.categories.length, 0)),
    [sections]
  );
  const optionId = React.useCallback((index: number) => `${listboxId}-option-${index}`, [listboxId]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    // Si riparte sempre dalla cima (le più usate): chi apre il selettore cerca una categoria diversa dall'attuale.
    if (next) {
      setQuery("");
      setActiveIndex(0);
    }
  }

  function choose(categoryId: string) {
    setOpen(false);
    if (categoryId !== value) onValueChange(categoryId);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (options.length === 0) return;
    const moves: Record<string, number> = {
      ArrowDown: (activeIndex + 1) % options.length,
      ArrowUp: (activeIndex - 1 + options.length) % options.length,
      Home: 0,
      End: options.length - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      setActiveIndex(moves[event.key]);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) choose(option.id);
    }
  }

  React.useEffect(() => {
    if (!open) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open, optionId]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        disabled={disabled}
        aria-label={selected ? `${ariaLabel}: ${selected.name}` : ariaLabel}
        data-size={size}
        className={cn(
          "flex w-fit min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] dark:bg-input/30 dark:hover:bg-input/50",
          className
        )}
      >
        {selected ? <CategoryLabel category={selected} /> : <span className="text-muted-foreground">{placeholder}</span>}
        <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 max-w-[calc(100vw-2rem)] gap-0 p-0"
        // Su touch niente focus automatico sulla ricerca: la tastiera coprirebbe la lista.
        initialFocus={(openType) => (openType === "touch" ? false : inputRef.current)}
      >
        <div className="flex items-center gap-2 border-b border-border px-2.5">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={searchPlaceholder}
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={options.length > 0 ? optionId(activeIndex) : undefined}
            aria-label={searchPlaceholder}
            className="h-10 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div id={listboxId} role="listbox" aria-label={ariaLabel} className="max-h-72 overflow-y-auto p-1">
          {options.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>}
          {sections.map((section, sectionIndex) => (
            <div key={section.key} role="group" aria-label={section.label ?? undefined} className="py-0.5">
              {section.label && <p className="px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">{section.label}</p>}
              {section.categories.map((category, categoryIndex) => {
                const index = sectionOffsets[sectionIndex] + categoryIndex;
                const isActive = index === activeIndex;
                const isSelected = category.id === value;
                return (
                  <div
                    key={`${section.key}-${category.id}`}
                    id={optionId(index)}
                    role="option"
                    aria-selected={isSelected}
                    onMouseMove={() => !isActive && setActiveIndex(index)}
                    onClick={() => choose(category.id)}
                    className={cn(
                      "flex min-h-9 cursor-default items-center justify-between gap-2 rounded-md px-2 py-1 text-sm select-none sm:min-h-8",
                      isActive && "bg-accent text-accent-foreground"
                    )}
                  >
                    <CategoryLabel category={category} />
                    {isSelected && <CheckIcon className="size-4 shrink-0" aria-hidden="true" />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
