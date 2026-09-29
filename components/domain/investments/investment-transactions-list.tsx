"use client";

/**
 * Operazioni registrate raggruppate per mese (dal più recente), con filtro per anno, totali dell'anno scelto
 * (acquistato, venduto, proventi, guadagno) e il guadagno di ogni operazione. Eliminazione per riga: il server rifiuta
 * se renderebbe negative le quote.
 */

import * as React from "react";
import { SegmentedControl } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Instrument, InvestmentTransaction } from "@/lib/db/schema/investments";
import {
  operationYears,
  sumOperationTotals,
  type OperationMonthGroup as MonthGroup,
} from "@/lib/investments/operations-history";
import { OperationMonthGroup } from "./operation-month-group";
import { OperationsTotals } from "./operations-totals";

/** Mesi mostrati prima di "Mostra tutti". */
export const RECENT_OPERATION_MONTHS_LIMIT = 3;
const ALL_YEARS = "tutti";

export interface InvestmentTransactionsListProps {
  months: MonthGroup<InvestmentTransaction>[];
  instrumentsById: Map<string, Instrument>;
  currency: string;
  showAll: boolean;
  onToggleShowAll: () => void;
  onDelete: (transaction: InvestmentTransaction) => void;
  deletingId?: string | null;
}

export function InvestmentTransactionsList({
  months,
  instrumentsById,
  currency,
  showAll,
  onToggleShowAll,
  onDelete,
  deletingId,
}: InvestmentTransactionsListProps) {
  const years = React.useMemo(() => operationYears(months), [months]);
  const [year, setYear] = React.useState<string>(ALL_YEARS);
  // Se l'anno scelto sparisce (operazioni eliminate) si torna a tutti gli anni.
  const selectedYear = year !== ALL_YEARS && !years.includes(Number(year)) ? ALL_YEARS : year;
  const filtered = React.useMemo(
    () => (selectedYear === ALL_YEARS ? months : months.filter((m) => m.year === Number(selectedYear))),
    [months, selectedYear]
  );
  const totals = React.useMemo(() => sumOperationTotals(filtered.flatMap((m) => m.operations)), [filtered]);
  const visible = showAll ? filtered : filtered.slice(0, RECENT_OPERATION_MONTHS_LIMIT);
  const yearOptions = [
    { value: ALL_YEARS, label: "Tutti" },
    ...years.map((y) => ({ value: String(y), label: String(y) })),
  ];

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operazioni</CardTitle>
          {years.length > 1 ? (
            <div className="max-w-full overflow-x-auto">
              <SegmentedControl options={yearOptions} value={selectedYear} onChange={setYear} ariaLabel="Anno delle operazioni" />
            </div>
          ) : null}
        </div>
        {months.length > 0 ? (
          <>
            <OperationsTotals totals={totals} currency={currency} />
            <p className="text-xs text-muted-foreground">
              Per un acquisto il guadagno è quanto valgono oggi le quote ancora possedute rispetto a quanto le hai pagate;
              per una vendita è il guadagno realizzato.
            </p>
          </>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {months.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">Nessuna operazione registrata.</p>
        ) : (
          <div className="border-t border-border">
            {visible.map((group) => (
              <OperationMonthGroup
                key={group.key}
                group={group}
                instrumentsById={instrumentsById}
                currency={currency}
                deletingId={deletingId}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
        {filtered.length > RECENT_OPERATION_MONTHS_LIMIT ? (
          <div className="border-t border-border px-4 py-2 sm:px-6">
            <Button variant="link" className="px-0" onClick={onToggleShowAll}>
              {showAll ? "Mostra solo i mesi più recenti" : `Mostra tutti i mesi (${filtered.length})`}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
