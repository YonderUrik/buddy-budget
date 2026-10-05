"use client";

/** Riepilogo compatto del periodo in testa alla lista transazioni: spese ed entrate effettive, con quote escluse spiegate. */

import { InfoHint } from "@/components/domain/shared";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ExpensesSummary, IncomeSummary } from "@/lib/calc/expenses";

export interface TransactionsPeriodSummaryProps {
  expenses: ExpensesSummary;
  income: IncomeSummary;
  currency: string;
  /** Quante transazioni del periodo sono divise; se > 0 compare la riga "esclusi dal conteggio" con il filtro. */
  splitCount?: number;
  /** true = la lista mostra solo le transazioni divise. */
  splitOnly?: boolean;
  onToggleSplitOnly?: () => void;
}

export function TransactionsPeriodSummary({ expenses, income, currency, splitCount = 0, splitOnly = false, onToggleSplitOnly }: TransactionsPeriodSummaryProps) {
  const totalExcluded = expenses.escluse + income.escluse;
  const net = income.entrateEffettive - expenses.speseEffettive;

  return (
    <>
    <p className="flex flex-wrap items-baseline gap-x-3 border-b border-border px-4 py-2 text-xs text-muted-foreground tabular-nums sm:hidden">
      <span>
        Spese <b className="font-medium text-foreground">{formatCurrency(expenses.speseEffettive, currency)}</b>
      </span>
      <span>
        Entrate <b className="font-medium text-pos">{formatCurrency(income.entrateEffettive, currency)}</b>
      </span>
      <span>
        Saldo <b className={cn("font-medium", net < 0 ? "text-neg" : "text-foreground")}>{formatCurrency(net, currency)}</b>
      </span>
      {totalExcluded > 0 && <span>Esclusi {formatCurrency(totalExcluded, currency)}</span>}
    </p>
    <dl className="hidden grid-cols-3 gap-3 border-b border-border px-4 py-3 sm:grid">
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">Spese</dt>
        <dd className="truncate font-heading text-lg font-medium tabular-nums text-foreground">
          {formatCurrency(expenses.speseEffettive, currency)}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">Entrate</dt>
        <dd className="truncate font-heading text-lg font-medium tabular-nums text-pos">
          {formatCurrency(income.entrateEffettive, currency)}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="flex items-center gap-0.5 text-xs text-muted-foreground">
          Saldo
          <InfoHint label="Come sono calcolati questi importi?">
            Spese ed entrate sono al netto delle quote escluse con &ldquo;Dividi&rdquo; (quote di altri, rimborsi,
            giroconti).
            {totalExcluded > 0 && (
              <>
                {" "}
                In questo periodo sono esclusi {formatCurrency(expenses.escluse, currency)} di uscite e{" "}
                {formatCurrency(income.escluse, currency)} di entrate.
              </>
            )}
          </InfoHint>
        </dt>
        <dd
          className={cn("truncate font-heading text-lg font-medium tabular-nums", net < 0 ? "text-neg" : "text-foreground")}
        >
          {formatCurrency(net, currency)}
        </dd>
      </div>
    </dl>
    {splitCount > 0 && onToggleSplitOnly && (
      <div className="hidden items-center justify-between gap-3 border-b border-border bg-primary/5 px-4 py-2 text-sm sm:flex">
        <p className="min-w-0 text-foreground">
          <span className="font-medium tabular-nums">{splitCount}</span> {splitCount === 1 ? "movimento diviso" : "movimenti divisi"}:{" "}
          <span className="font-medium tabular-nums text-primary">{formatCurrency(totalExcluded, currency)}</span> esclusi dal conteggio
        </p>
        <button
          type="button"
          onClick={onToggleSplitOnly}
          aria-pressed={splitOnly}
          className={cn(
            "h-9 shrink-0 rounded-full border border-border bg-card px-3 text-xs font-medium",
            splitOnly && "border-primary bg-primary text-primary-foreground"
          )}
        >
          {splitOnly ? "Mostra tutte" : "Mostra solo queste"}
        </button>
      </div>
    )}
    </>
  );
}
