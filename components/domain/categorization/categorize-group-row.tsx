"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/**
 * Riga di un gruppo di transazioni (stesso merchant) nella pagina di revisione categorizzazione.
 * Layout a colonna unica dopo la checkbox, così resta leggibile anche su mobile: logo, nome, quando e totale,
 * poi categoria + "Dividi", poi il perché della proposta e il dettaglio dei movimenti a richiesta.
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
import { localizedCategorizationText } from "@/lib/categorization/origin";

import { cn } from "@/lib/utils";
import { MerchantLogo } from "./merchant-logo";
import { MovementsPreview } from "./movements-preview";
import { SuggestionOrigin } from "./suggestion-origin";

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
  /** Chiamata quando la riga mostra un logo remoto (per citare la fonte dei loghi). */
  onRemoteLogo?: () => void;
}

/** Number of transactions in the group, singular or plural, in the user's language. */
function movementCountLabel(count: number, tr: (source: string, values?: Record<string, number>) => string): string {
  return count === 1 ? tr("1 movimento") : tr("{0} movimenti", { 0: count });
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
  onRemoteLogo,
}: CategorizeGroupRowProps) {
  const { dateRangeLabel } = localizedCategorizationText(useLocalization().language);

  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const [expanded, setExpanded] = React.useState(false);
  const [splitOpen, setSplitOpen] = React.useState(false);
  const detailsId = React.useId();

  const isIncome = group.totalAmount > 0;
  // La fallback ("Da categorizzare") non è mai una scelta valida qui: assegnarla creerebbe una regola
  // "appresa" che intrappola per sempre quel merchant nel fallback (vince su ogni regola futura più
  // specifica). Sceglierla di nuovo non ha senso in una pagina che serve a uscire dal fallback.
  const selectableCategories = React.useMemo(
    () => categories.filter((c) => !c.isFallback && (c.type === "trasferimento" || (isIncome ? c.type === "entrata" : c.type !== "entrata"))),
    [categories, isIncome]
  );

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3",
        selected && "bg-primary/5"
      )}
    >
      <Checkbox
        checked={selected}
        disabled={Boolean(disabledReason)}
        title={disabledReason}
        aria-label={tr("Seleziona {0}", {0: group.label})}
        onCheckedChange={(checked) => onToggleSelected(checked === true)}
        className="mt-0.5"
      />

      <MerchantLogo name={group.label} logoPath={group.logoPath} size="sm" onRemoteLogo={onRemoteLogo} className="-mt-0.5" />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <p className="line-clamp-2 min-w-0 text-sm font-medium break-words text-foreground">{group.label}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {movementCountLabel(group.transactionIds.length, tr)} {"·"}{dateRangeLabel(group.transactionDates)}
            </p>
          </div>
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
            placeholder={tr("Scegli categoria")}
            className="min-w-0 flex-1 data-[size=default]:h-9 sm:w-60 sm:flex-none sm:data-[size=default]:h-8"
          />
          <Button
            type="button"
            variant={splitOpen ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSplitOpen((v) => !v)}
            aria-pressed={splitOpen}
            className="h-9 shrink-0 sm:h-8"
            title={tr("Escludi una parte dell'importo dal conteggio (quote di altri, rimborsi, giroconti)")}
          >{tr("Dividi")}{excludedPercentage > 0 && ` · ${Math.round(excludedPercentage * 100)}%`}
          </Button>
        </div>

        {disabledReason ? (
          <p className="text-xs text-muted-foreground">{disabledReason}</p>
        ) : (
          group.suggestion && <SuggestionOrigin suggestion={group.suggestion} />
        )}

        {group.hasDivergentSuggestions && (
          <p className="text-xs text-neg">{tr("Le transazioni di questo gruppo avevano proposte diverse — controlla prima di applicare.")}</p>
        )}

        {splitOpen && (
          <div className="flex flex-col gap-2 rounded-lg bg-muted/50 px-3 py-2">
            <Slider
              value={[excludedPercentage * 100]}
              min={0}
              max={100}
              step={1}
              aria-label={tr("Quota esclusa dal conteggio")}
              onValueChange={(value) => {
                const next = Array.isArray(value) ? value[0] : value;
                onExcludedPercentageChange(next / 100);
              }}
            />
            <div className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
              <span>{tr("Esclusa dal conteggio:")}{" "}{Math.round(excludedPercentage * 100)}{"%"}</span>
              <span>
                {isIncome ? tr("Entrata effettiva") : tr("Spesa effettiva")}{":"}{" "}
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
          {expanded ? tr("Nascondi") : tr("Mostra")}{" "}{group.transactionIds.length === 1 ? tr("il movimento") : tr("i {0} movimenti", { 0: group.transactionIds.length })}
          <ChevronDownIcon className={cn("size-3.5 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
        </button>

        {expanded && (
          <div id={detailsId} className="border-l border-border pl-3">
            <MovementsPreview
              label={group.label}
              dates={group.transactionDates}
              amounts={group.transactionAmounts}
              descriptions={group.transactionDescriptions}
              currency={currency}
              limit={group.transactionIds.length}
            />
          </div>
        )}
      </div>
    </div>
  );
}
