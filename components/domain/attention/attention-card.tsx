"use client";

/**
 * Card "Da sistemare" della Panoramica: quante transazioni sono nuove o da categorizzare e le prime righe, ciascuna
 * lavorabile sul posto: si può confermare la categoria proposta, sceglierne un'altra, decidere se ricordare la scelta
 * per quell'esercente, vedere le transazioni o rimandare. Presentazionale: dati e azioni arrivano via props.
 */

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, ChevronDownIcon } from "lucide-react";
import { CategoryPicker } from "@/components/domain/categories";
import { SuggestionSourceBadge } from "@/components/domain/categorization";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { describeAttention } from "@/lib/attention";
import type { CategoryUsageCounts } from "@/lib/categories/picker";
import type { Category } from "@/lib/db/schema/categories";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AttentionRowData } from "./attention-card.utils";

export interface AttentionCardRow extends AttentionRowData {
  /** Categoria attualmente scelta (di partenza: la proposta); stringa vuota = nessuna. */
  categoryId: string;
  /** Se la scelta diventa una regola per l'esercente. */
  createRule: boolean;
}

export interface AttentionCardProps {
  newCount: number;
  uncategorizedCount: number;
  rows: AttentionCardRow[];
  /** Quanti gruppi in più restano oltre alle righe mostrate. */
  moreCount?: number;
  categories: Category[];
  categoryUsage?: CategoryUsageCounts;
  currency: string;
  /** Riga in corso di conferma (disabilita i suoi comandi). */
  confirmingGroupKey?: string | null;
  onConfirm: (row: AttentionCardRow) => void;
  onCategoryChange: (row: AttentionCardRow, categoryId: string) => void;
  onCreateRuleChange: (row: AttentionCardRow, createRule: boolean) => void;
  /** Nasconde la riga fino alla prossima visita (non cambia i dati). */
  onSkip: (row: AttentionCardRow) => void;
  /** Schermata di categorizzazione in blocco. */
  categorizeHref?: string;
  /** Schermata dei movimenti, usata quando non c'è nulla da categorizzare (solo transazioni nuove). */
  movementsHref?: string;
  onLinkClick?: () => void;
}

function transactionCountLabel(count: number): string {
  return count === 1 ? "1 transazione" : `${count} transazioni`;
}

/** Singola riga: esercente, importo, scelta della categoria e azioni. */
function AttentionRow({
  row,
  categories,
  categoryUsage,
  currency,
  confirming,
  onConfirm,
  onCategoryChange,
  onCreateRuleChange,
  onSkip,
}: {
  row: AttentionCardRow;
  categories: Category[];
  categoryUsage?: CategoryUsageCounts;
  currency: string;
  confirming: boolean;
  onConfirm: () => void;
  onCategoryChange: (categoryId: string) => void;
  onCreateRuleChange: (createRule: boolean) => void;
  onSkip: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const detailsId = React.useId();
  const ruleId = React.useId();
  // La fallback non è mai una scelta valida: assegnarla creerebbe una regola che intrappola l'esercente nel fallback.
  const selectable = React.useMemo(
    () => categories.filter((c) => !c.isFallback && (row.isIncome ? c.type === "entrata" : c.type !== "entrata")),
    [categories, row.isIncome]
  );
  const changed = row.suggestedCategoryId !== null && row.categoryId !== row.suggestedCategoryId;

  return (
    <li className="flex flex-col gap-2.5 border-t px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2">
          <span className="truncate text-sm font-medium text-foreground">{row.label}</span>
          {row.isNew && (
            <span className="shrink-0 rounded-full border border-primary px-1.5 py-px text-[11px] font-bold uppercase tracking-wide text-primary">
              Nuova
            </span>
          )}
        </div>
        <span className={cn("shrink-0 text-sm font-semibold tabular-nums", row.totalAmount > 0 ? "text-pos" : "text-foreground")}>
          {formatCurrency(row.totalAmount, currency)}
        </span>
      </div>

      <CategoryPicker
        categories={selectable}
        value={row.categoryId}
        onValueChange={onCategoryChange}
        usage={categoryUsage}
        placeholder="Scegli categoria"
        aria-label={`Categoria per ${row.label}`}
        className="w-full data-[size=default]:h-10"
        disabled={confirming}
      />

      {row.suggestion && !changed ? <SuggestionSourceBadge suggestion={row.suggestion} /> : null}
      {changed ? <p className="text-sm text-muted-foreground">Hai scelto una categoria diversa dalla proposta.</p> : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-h-11 items-center gap-2">
          <Checkbox id={ruleId} checked={row.createRule} onCheckedChange={(checked) => onCreateRuleChange(checked === true)} disabled={confirming} />
          <label htmlFor={ruleId} className="text-sm text-foreground">
            Ricorda per i prossimi
          </label>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={onSkip} disabled={confirming} className="min-h-11 px-3">
            Dopo
          </Button>
          <Button type="button" onClick={onConfirm} disabled={confirming || row.categoryId === ""} className="min-h-11 px-4">
            Conferma
          </Button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={detailsId}
        className="flex min-h-9 w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {expanded ? "Nascondi" : "Mostra"} {transactionCountLabel(row.transactionCount)}
        <ChevronDownIcon className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
      </button>
      {expanded ? (
        <ul id={detailsId} className="flex flex-col gap-1 border-l pl-3 text-sm text-muted-foreground">
          {row.transactionDescriptions.map((description, index) => (
            <li key={`${row.groupKey}-${index}`} className="break-words">
              {description}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function AttentionCard({
  newCount,
  uncategorizedCount,
  rows,
  moreCount = 0,
  categories,
  categoryUsage,
  currency,
  confirmingGroupKey = null,
  onConfirm,
  onCategoryChange,
  onCreateRuleChange,
  onSkip,
  categorizeHref = "/categorizza",
  movementsHref = "/movimenti",
  onLinkClick,
}: AttentionCardProps) {
  const linkHref = uncategorizedCount > 0 ? categorizeHref : movementsHref;
  const linkLabel = uncategorizedCount > 0 ? "Categorizza tutte" : "Vedi i movimenti";

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <h2 className="font-heading text-lg font-medium text-foreground">Da sistemare</h2>
          <p className="text-sm text-muted-foreground">{describeAttention(newCount, uncategorizedCount)}</p>
        </div>
        <Link
          href={linkHref}
          onClick={onLinkClick}
          className="-mr-2 flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {linkLabel}
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Link>
      </div>
      {rows.length > 0 && (
        <ul>
          {rows.map((row) => (
            <AttentionRow
              key={row.groupKey}
              row={row}
              categories={categories}
              categoryUsage={categoryUsage}
              currency={currency}
              confirming={confirmingGroupKey === row.groupKey}
              onConfirm={() => onConfirm(row)}
              onCategoryChange={(categoryId) => onCategoryChange(row, categoryId)}
              onCreateRuleChange={(createRule) => onCreateRuleChange(row, createRule)}
              onSkip={() => onSkip(row)}
            />
          ))}
        </ul>
      )}
      {moreCount > 0 ? (
        <Link
          href={categorizeHref}
          onClick={onLinkClick}
          className="flex min-h-11 items-center justify-center border-t text-sm font-semibold text-primary hover:underline"
        >
          Altri {moreCount} gruppi da sistemare
        </Link>
      ) : null}
    </Card>
  );
}
