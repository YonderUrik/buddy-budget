"use client";

/** Card "Mese per mese": dividendi e cedole registrati in un anno, netto più ritenute (= lordo), con i totali. */

import { IncomePayments } from "./income-payments";
import type { IncomePayment } from "@/lib/investments/income";
import type { Instrument } from "@/lib/db/schema/investments";
import { track } from "@/lib/analytics";
import * as React from "react";
import { SegmentedControl } from "@/components/domain/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { IncomeYearDetail } from "@/lib/investments/dividends";
import { formatPct, shortMonthLabel } from "../percent";
import { MonthBars } from "./month-bars";

export interface IncomeMonthsCardProps {
  years: IncomeYearDetail[];
  payments: IncomePayment[];
  instrumentsById: Map<string, Instrument>;
  currency: string;
}

export function IncomeMonthsCard({ years, payments, instrumentsById, currency }: IncomeMonthsCardProps) {
  const options = years.map((y) => ({ value: String(y.year), label: String(y.year) }));
  const [selected, setSelected] = React.useState(options[0]?.value ?? "");
  const [expanded, setExpanded] = React.useState(false);
  const year = years.find((y) => String(y.year) === selected) ?? years[0];
  if (!year) return null;
  const format = (amount: number) => formatCurrency(amount, currency, { maximumFractionDigits: 0 });

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mese per mese</CardTitle>
        {options.length > 0 ? <SegmentedControl options={options} value={String(year.year)} onChange={(value) => { setSelected(value); setExpanded(true); track("investment_dividends_details_opened", { source: "year" }); }} className="flex-wrap max-w-full" ariaLabel="Anno" /> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Lordo</dt>
            <dd className="font-heading text-lg font-medium tabular-nums text-foreground">{format(year.gross)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Ritenute e costi</dt>
            <dd className="font-heading text-lg font-medium tabular-nums text-foreground">
              {format(year.withheld)}
              {year.gross > 0 ? <span className="ml-1 text-xs font-normal text-muted-foreground">{formatPct(year.withheld / year.gross, 0)}</span> : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Netto</dt>
            <dd className="font-heading text-lg font-medium tabular-nums text-pos">{format(year.net)}</dd>
          </div>
        </dl>
        <details open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
          <summary className="cursor-pointer py-2 text-sm font-medium">Pagamenti del {year.year}</summary>
          <IncomePayments payments={payments.filter((payment) => payment.date.startsWith(String(year.year)))} currency={currency} instrumentsById={instrumentsById} />
        </details>
        <MonthBars
          ariaLabel={`Incassi del ${year.year} per mese`}
          bars={year.months.map((m) => ({
            key: String(m.month),
            label: shortMonthLabel(m.month),
            primary: Math.max(m.net, 0),
            secondary: m.withheld,
            title: `${shortMonthLabel(m.month)} ${year.year} · ${payments.filter((p) => p.date.startsWith(`${year.year}-${String(m.month).padStart(2, "0")}`)).length} pagamenti\nLordo: ${formatCurrency(m.gross, currency)}\nImposte e costi: ${formatCurrency(m.withheld, currency)}\nNetto: ${formatCurrency(m.net, currency)}`,
          }))}
        />
        <p className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-pos" aria-hidden="true" /> Netto
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-muted-foreground/30" aria-hidden="true" /> Ritenute e costi
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
