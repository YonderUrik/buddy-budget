"use client";

/**
 * Card "Da sistemare" della Panoramica: quante transazioni sono nuove o da categorizzare e le prime righe,
 * ciascuna confermabile in un tocco con la categoria proposta. Presentazionale: dati e azioni arrivano via props.
 */

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { describeAttention } from "@/lib/attention";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AttentionRowData } from "./attention-card.utils";

export interface AttentionCardRow extends AttentionRowData {
  /** Nome della categoria proposta (già risolto), assente se non c'è proposta. */
  suggestedCategoryName: string | null;
}

export interface AttentionCardProps {
  newCount: number;
  uncategorizedCount: number;
  rows: AttentionCardRow[];
  currency: string;
  /** Riga in corso di conferma (disabilita il suo pulsante). */
  confirmingGroupKey?: string | null;
  onConfirm: (row: AttentionCardRow) => void;
  /** Schermata di categorizzazione in blocco. */
  categorizeHref?: string;
  /** Schermata dei movimenti, usata quando non c'è nulla da categorizzare (solo transazioni nuove). */
  movementsHref?: string;
  onLinkClick?: () => void;
}

/** Singola riga: negozio, importo e azione (conferma della proposta o scelta manuale). */
function AttentionRow({
  row,
  currency,
  confirming,
  onConfirm,
  categorizeHref,
}: {
  row: AttentionCardRow;
  currency: string;
  confirming: boolean;
  onConfirm: () => void;
  categorizeHref: string;
}) {
  const hasSuggestion = row.suggestedCategoryName !== null;
  return (
    <li className="flex flex-col gap-2 border-t px-4 py-3 @lg/attention:flex-row @lg/attention:items-center @lg/attention:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm font-medium text-foreground">{row.label}</span>
        {row.transactionCount > 1 && (
          <span className="shrink-0 text-xs text-muted-foreground">{row.transactionCount} transazioni</span>
        )}
        {row.isNew && (
          <span className="shrink-0 rounded-full border border-primary px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-primary">
            Nuova
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 @lg/attention:justify-end">
        <span
          className={cn(
            "text-sm font-semibold tabular-nums",
            row.totalAmount > 0 ? "text-pos" : "text-foreground"
          )}
        >
          {formatCurrency(row.totalAmount, currency)}
        </span>
        {hasSuggestion ? (
          <span className="flex items-center gap-2">
            <span className="max-w-32 truncate rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {row.suggestedCategoryName}
            </span>
            <Button size="sm" onClick={onConfirm} disabled={confirming}>
              Conferma
            </Button>
          </span>
        ) : (
          <Link href={categorizeHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Scegli categoria
          </Link>
        )}
      </div>
    </li>
  );
}

export function AttentionCard({
  newCount,
  uncategorizedCount,
  rows,
  currency,
  confirmingGroupKey = null,
  onConfirm,
  categorizeHref = "/categorizza",
  movementsHref = "/movimenti",
  onLinkClick,
}: AttentionCardProps) {
  const linkHref = uncategorizedCount > 0 ? categorizeHref : movementsHref;
  const linkLabel = uncategorizedCount > 0 ? "Categorizza tutte" : "Vedi i movimenti";

  return (
    <Card className="@container/attention gap-0 py-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
          <h2 className="font-heading text-sm font-semibold text-foreground">Da sistemare</h2>
          <p className="text-sm text-muted-foreground">{describeAttention(newCount, uncategorizedCount)}</p>
        </div>
        <Link
          href={linkHref}
          onClick={onLinkClick}
          className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          {linkLabel}
          <ArrowRightIcon className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      {rows.length > 0 && (
        <ul>
          {rows.map((row) => (
            <AttentionRow
              key={row.groupKey}
              row={row}
              currency={currency}
              confirming={confirmingGroupKey === row.groupKey}
              onConfirm={() => onConfirm(row)}
              categorizeHref={categorizeHref}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
