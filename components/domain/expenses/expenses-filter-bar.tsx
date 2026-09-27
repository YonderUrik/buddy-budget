"use client";

/** Barra filtri della schermata Transazioni: select categoria singola + ricerca testo (descrizione e nota), entrambi controllati. Il tasto "/" porta il focus sulla ricerca. */

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryAvatar } from "@/components/domain/categories";
import type { Category } from "@/lib/db/schema/categories";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";

const ALL_CATEGORIES_VALUE = "__all__";

export interface ExpensesFilterBarProps {
  categories: Category[];
  /** null = nessun filtro categoria attivo ("Tutte le categorie"). */
  categoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  searchText: string;
  onSearchTextChange: (text: string) => void;
}

export function ExpensesFilterBar({
  categories,
  categoryId,
  onCategoryChange,
  searchText,
  onSearchTextChange,
}: ExpensesFilterBarProps) {
  const searchRef = React.useRef<HTMLInputElement>(null);

  // "/" porta il focus sulla ricerca, salvo quando l'utente sta già scrivendo in un campo.
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center sm:gap-3">
      <Select
        value={categoryId ?? ALL_CATEGORIES_VALUE}
        onValueChange={(value) => onCategoryChange(value === ALL_CATEGORIES_VALUE ? null : value)}
      >
        <SelectTrigger
          size="sm"
          aria-label="Filtra per categoria"
          className="order-2 w-full min-w-0 data-[size=sm]:h-9 sm:order-1 sm:w-56 sm:data-[size=sm]:h-8"
        >
          <SelectValue>
            {(value: string) => {
              if (value === ALL_CATEGORIES_VALUE) return "Tutte le categorie";
              const selected = categories.find((c) => c.id === value);
              if (!selected) return "Tutte le categorie";
              return (
                <span className="flex min-w-0 items-center gap-1.5">
                  <CategoryAvatar
                    color={selected.color as CategoryColor}
                    icon={selected.icon as CategoryIcon}
                    size={10}
                    className="size-4 shrink-0"
                  />
                  <span className="truncate">{selected.name}</span>
                </span>
              );
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_CATEGORIES_VALUE}>Tutte le categorie</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              <span className="flex items-center gap-1.5">
                <CategoryAvatar
                  color={category.color as CategoryColor}
                  icon={category.icon as CategoryIcon}
                  size={10}
                  className="size-4"
                />
                {category.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        ref={searchRef}
        type="search"
        value={searchText}
        onChange={(e) => onSearchTextChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onSearchTextChange("");
        }}
        placeholder="Cerca…"
        className="order-1 h-9 w-full min-w-0 sm:order-2 sm:h-8 sm:w-56"
        aria-label="Cerca transazioni per descrizione o nota"
        aria-keyshortcuts="/"
      />
    </div>
  );
}
