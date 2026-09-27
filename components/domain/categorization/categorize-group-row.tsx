"use client";

/** Riga di un gruppo di transazioni (stesso merchant) nella pagina di revisione categorizzazione. */

import * as React from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { CategoryPicker } from "@/components/domain/categories";
import type { Category } from "@/lib/db/schema/categories";
import type { CategoryUsageCounts } from "@/lib/categories/picker";
import type { SuggestionGroup } from "@/lib/categorization/suggest";
import { formatCurrency } from "@/lib/format";
import { SuggestionSourceBadge } from "./suggestion-source-badge";

export interface CategorizeGroupRowProps {
  group: SuggestionGroup;
  categories: Category[];
  currency: string;
  selected: boolean;
  categoryId: string;
  excludedPercentage: number;
  /** Utilizzi per categoria, per mostrare in cima le più usate nel selettore. */
  categoryUsage?: CategoryUsageCounts;
  /** Se presente, il gruppo non ha una categoria di default disponibile: selezione disabilitata, motivo mostrato all'utente. */
  disabledReason?: string;
  onToggleSelected: (selected: boolean) => void;
  onCategoryChange: (categoryId: string) => void;
  onExcludedPercentageChange: (value: number) => void;
}

/** Numero di transazioni del gruppo con singolare/plurale corretto. */
function transactionCountLabel(count: number): string {
  return count === 1 ? "1 transazione" : `${count} transazioni`;
}

export function CategorizeGroupRow({
  group,
  categories,
  currency,
  selected,
  categoryId,
  excludedPercentage,
  categoryUsage,
  disabledReason,
  onToggleSelected,
  onCategoryChange,
  onExcludedPercentageChange,
}: CategorizeGroupRowProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [splitOpen, setSplitOpen] = React.useState(false);

  const isIncome = group.totalAmount > 0;
  // La fallback ("Da categorizzare") non è mai una scelta valida qui: assegnarla creerebbe una regola
  // "appresa" che intrappola per sempre quel merchant nel fallback (vince su ogni regola futura più
  // specifica). Sceglierla di nuovo non ha senso in una pagina che serve a uscire dal fallback.
  const selectableCategories = React.useMemo(
    () => categories.filter((c) => !c.isFallback && (isIncome ? c.type === "entrata" : c.type !== "entrata")),
    [categories, isIncome]
  );

  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-3">
        <Checkbox
          checked={selected}
          disabled={Boolean(disabledReason)}
          title={disabledReason}
          onCheckedChange={(checked) => onToggleSelected(checked === true)}
        />

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          {expanded ? (
            <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{group.label}</span>
            <span className="block text-xs text-muted-foreground">
              {transactionCountLabel(group.transactionIds.length)}
            </span>
          </span>
        </button>

        <span className="shrink-0 text-sm font-medium text-foreground">
          {formatCurrency(group.totalAmount, currency)}
        </span>

        <CategoryPicker
          categories={selectableCategories}
          value={categoryId}
          onValueChange={onCategoryChange}
          usage={categoryUsage}
          size="sm"
          className="h-8 max-w-48 shrink-0 text-xs"
        />

        <Button type="button" variant="ghost" size="sm" onClick={() => setSplitOpen((v) => !v)} className="shrink-0">
          Dividi
        </Button>
      </div>

      {disabledReason && <p className="text-xs text-neg">{disabledReason}</p>}

      {group.suggestion && <SuggestionSourceBadge suggestion={group.suggestion} />}

      {group.hasDivergentSuggestions && (
        <p className="text-xs text-neg">
          Le transazioni di questo gruppo avevano proposte diverse — controlla prima di applicare.
        </p>
      )}

      {splitOpen && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
          <Slider
            value={[excludedPercentage * 100]}
            min={0}
            max={100}
            step={1}
            onValueChange={(value) => {
              const next = Array.isArray(value) ? value[0] : value;
              onExcludedPercentageChange(next / 100);
            }}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Quota esclusa dal conteggio: {Math.round(excludedPercentage * 100)}%</span>
            <span>
              {isIncome ? "Entrata effettiva" : "Spesa effettiva"}:{" "}
              {formatCurrency(group.totalAmount * (1 - excludedPercentage), currency)}
            </span>
          </div>
        </div>
      )}

      {expanded && (
        <ul className="flex flex-col gap-1 pl-6 text-xs text-muted-foreground">
          {group.transactionDescriptions.map((description, index) => (
            <li key={group.transactionIds[index]} className="truncate">
              {description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
