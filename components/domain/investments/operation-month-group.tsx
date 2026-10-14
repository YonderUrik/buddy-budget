"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/** Un mese di operazioni: intestazione con mese e anno, totali del mese e l'elenco delle operazioni. */

import type { Instrument, InvestmentTransaction } from "@/lib/db/schema/investments";
import type { OperationMonthGroup as MonthGroup } from "@/lib/investments/operations-history";

import { GainText } from "./gain-text";
import { OperationRow } from "./operation-row";

export interface OperationMonthGroupProps {
  group: MonthGroup<InvestmentTransaction>;
  instrumentsById: Map<string, Instrument>;
  currency: string;
  deletingId?: string | null;
  onEdit?: (transaction: InvestmentTransaction) => void;
  onDelete: (transaction: InvestmentTransaction) => void;
}

export function OperationMonthGroup({ group, instrumentsById, currency, deletingId, onEdit, onDelete }: OperationMonthGroupProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency, formatMonthLabel } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const { totals } = group;
  const format = (amount: number) => formatCurrency(amount, currency, { maximumFractionDigits: 0 });
  const parts = [
    totals.bought > 0 ? tr("acquistato {0}", {0: format(totals.bought)}) : null,
    totals.sold > 0 ? tr("venduto {0}", {0: format(totals.sold)}) : null,
    totals.income > 0 ? tr("proventi {0}", {0: format(totals.income)}) : null,
  ].filter(Boolean);
  const headingId = `operations-${group.key}`;
  return (
    <section aria-labelledby={headingId}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 bg-muted/50 px-4 py-2 sm:px-6">
        <h3 id={headingId} className="text-sm font-semibold text-foreground">
          {formatMonthLabel(group.key)}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {totals.count === 1 ? tr("1 operazione") : tr("{0} operazioni", {0: totals.count})}
          </span>
        </h3>
        <p className="text-xs text-muted-foreground">
          {parts.join(" · ")}
          {parts.length > 0 ? " · " : ""}
          <GainText gain={totals.gain} pct={totals.gainPct} currency={currency} />
        </p>
      </div>
      <ul className="divide-y divide-border">
        {group.operations.map((insight) => (
          <OperationRow
            key={insight.transaction.id}
            insight={insight}
            instrument={instrumentsById.get(insight.transaction.instrumentId)}
            currency={currency}
            deleting={deletingId === insight.transaction.id}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </section>
  );
}
