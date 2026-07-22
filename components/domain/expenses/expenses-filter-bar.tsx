"use client";

/** Barra filtri della schermata Spese: select categoria singola + ricerca testo su descrizione, entrambi controllati. */

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
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={categoryId ?? ALL_CATEGORIES_VALUE}
        onValueChange={(value) => onCategoryChange(value === ALL_CATEGORIES_VALUE ? null : value)}
      >
        <SelectTrigger size="sm" className="w-56">
          <SelectValue>
            {(value: string) => {
              if (value === ALL_CATEGORIES_VALUE) return "Tutte le categorie";
              const selected = categories.find((c) => c.id === value);
              if (!selected) return "Tutte le categorie";
              return (
                <span className="flex items-center gap-1.5">
                  <CategoryAvatar
                    color={selected.color as CategoryColor}
                    icon={selected.icon as CategoryIcon}
                    size={10}
                    className="size-4"
                  />
                  {selected.name}
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
        value={searchText}
        onChange={(e) => onSearchTextChange(e.target.value)}
        placeholder="Cerca per descrizione..."
        className="h-8 w-56"
        aria-label="Cerca transazioni per descrizione"
      />
    </div>
  );
}
