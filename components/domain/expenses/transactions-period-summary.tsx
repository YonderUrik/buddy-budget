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
}

export function TransactionsPeriodSummary({ expenses, income, currency }: TransactionsPeriodSummaryProps) {
  const totalExcluded = expenses.escluse + income.escluse;
  const net = income.entrateEffettive - expenses.speseEffettive;

  return (
    <dl className="grid grid-cols-3 gap-3 border-b border-border px-4 py-3">
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
  );
}
