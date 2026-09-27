"use client";

/**
 * Riga di un gruppo di transazioni (stesso merchant) nella pagina di revisione categorizzazione.
 * Layout a colonna unica dopo la checkbox, così resta leggibile anche su mobile: nome e totale,
 * poi categoria + "Dividi", poi il perché della proposta e il dettaglio delle transazioni a richiesta.
 */

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { CategoryPicker } from "@/components/domain/categories";
import type { Category } from "@/lib/db/schema/categories";
import type { CategoryUsageCounts } from "@/lib/categories/picker";
import type { SuggestionGroup } from "@/lib/categorization/suggest";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
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
  const detailsId = React.useId();

  const isIncome = group.totalAmount > 0;
  // La fallback ("Da categorizzare") non è mai una scelta valida qui: assegnarla creerebbe una regola
  // "appresa" che intrappola per sempre quel merchant nel fallback (vince su ogni regola futura più
  // specifica). Sceglierla di nuovo non ha senso in una pagina che serve a uscire dal fallback.
  const selectableCategories = React.useMemo(
    () => categories.filter((c) => !c.isFallback && (isIncome ? c.type === "entrata" : c.type !== "entrata")),
    [categories, isIncome]
  );

  return (
    <div
      className={cn(
        "flex gap-3 border-b border-border px-4 py-3 last:border-b-0",
        selected && "bg-primary/5"
      )}
    >
      <Checkbox
        checked={selected}
        disabled={Boolean(disabledReason)}
        title={disabledReason}
        aria-label={`Seleziona ${group.label}`}
        onCheckedChange={(checked) => onToggleSelected(checked === true)}
        className="mt-0.5"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <p className="line-clamp-2 min-w-0 text-sm font-medium break-words text-foreground">{group.label}</p>
          <span className={cn("shrink-0 text-sm font-medium tabular-nums", isIncome ? "text-pos" : "text-foreground")}>
            {formatCurrency(group.totalAmount, currency)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <CategoryPicker
            categories={selectableCategories}
            value={categoryId}
            onValueChange={onCategoryChange}
            usage={categoryUsage}
            placeholder="Scegli categoria"
            className="min-w-0 flex-1 data-[size=default]:h-9 sm:w-60 sm:flex-none sm:data-[size=default]:h-8"
          />
          <Button
            type="button"
            variant={splitOpen ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSplitOpen((v) => !v)}
            aria-pressed={splitOpen}
            className="h-9 shrink-0 sm:h-8"
            title="Escludi una parte dell'importo dal conteggio (quote di altri, rimborsi, giroconti)"
          >
            Dividi
            {excludedPercentage > 0 && ` · ${Math.round(excludedPercentage * 100)}%`}
          </Button>
        </div>

        {disabledReason ? (
          <p className="text-xs text-muted-foreground">{disabledReason}</p>
        ) : (
          group.suggestion && <SuggestionSourceBadge suggestion={group.suggestion} />
        )}

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
              aria-label="Quota esclusa dal conteggio"
              onValueChange={(value) => {
                const next = Array.isArray(value) ? value[0] : value;
                onExcludedPercentageChange(next / 100);
              }}
            />
            <div className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
              <span>Esclusa dal conteggio: {Math.round(excludedPercentage * 100)}%</span>
              <span>
                {isIncome ? "Entrata effettiva" : "Spesa effettiva"}:{" "}
                {formatCurrency(group.totalAmount * (1 - excludedPercentage), currency)}
              </span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={detailsId}
          className="-my-1 flex w-fit items-center gap-1 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {expanded ? "Nascondi" : "Mostra"} {transactionCountLabel(group.transactionIds.length)}
          <ChevronDownIcon className={cn("size-3.5 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
        </button>

        {expanded && (
          <ul id={detailsId} className="flex flex-col gap-1 border-l border-border pl-3 text-xs text-muted-foreground">
            {group.transactionDescriptions.map((description, index) => (
              <li key={group.transactionIds[index]} className="break-words">
                {description}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
