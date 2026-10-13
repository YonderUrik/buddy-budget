"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/**
 * Card "Dividendi e cedole": quanto hai incassato negli ultimi 12 mesi, il rendimento da proventi sul costo, gli
 * anni a confronto e gli strumenti che pagano di più. Importi netti, in valuta utente.
 */

import { IncomePayments } from "./income/income-payments";
import { track } from "@/lib/analytics";
import type { Instrument } from "@/lib/db/schema/investments";

import type { IncomeHistory } from "@/lib/investments/income";
import { HandCoinsIcon } from "lucide-react";
import { PanelSection } from "./panel-section";

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(1).replace(".", ",")}%`;
}

export interface IncomeHistoryCardProps {
  income: IncomeHistory;
  instrumentsById: Map<string, Instrument>;
  currency: string;
}

export function IncomeHistoryCard({ income, instrumentsById, currency }: IncomeHistoryCardProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const format = (amount: number) => formatCurrency(amount, currency, { maximumFractionDigits: 0 });
  const maxYear = Math.max(...income.years.map((y) => y.amount), 0);

  return (
    <PanelSection icon={HandCoinsIcon} title={tr("Dividendi e cedole")} color="var(--swatch-amber)">
      <div className="flex flex-col gap-5">
        <p className="max-w-prose text-base text-foreground">{tr("Negli ultimi 12 mesi hai incassato")}{" "}<span className="font-semibold tabular-nums text-pos">{format(income.trailing)}</span>{" "}{tr("netti")}{income.yieldOnCost !== null && income.trailing > 0 ? (
            <span className="text-muted-foreground">{tr(", il")}{" "}<span className="tabular-nums">{pct(income.yieldOnCost)}</span>{" "}{tr("di quanto hai pagato per quello che possiedi")}</span>
          ) : null}
          .<span className="text-muted-foreground">{" "}{tr("Da sempre:")}{" "}{format(income.total)}.</span>
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          <ul className="flex flex-col gap-2" aria-label={tr("Dividendi per anno")}>
            {income.years.map((year) => (
              <li key={year.year} className="text-sm">
                <details onToggle={(event) => { if (event.currentTarget.open) track("investment_dividends_details_opened", { source: "year" }); }}>
                <summary className="cursor-pointer rounded-md py-2 focus-visible:outline-2" aria-label={tr("Dettaglio dividendi {0}", {0: year.year})}>
                <span className="inline-grid w-[calc(100%-1rem)] grid-cols-[3rem_1fr_auto] items-center gap-3" title={tr("{0}: {1} netti · {2} pagamenti", {0: year.year, 1: formatCurrency(year.amount, currency), 2: income.payments.filter((p) => p.date.startsWith(String(year.year))).length})}>
                <span className="tabular-nums text-muted-foreground">{year.year}</span>
                <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <span className="block h-full rounded-full bg-pos" style={{ width: `${maxYear > 0 ? (year.amount / maxYear) * 100 : 0}%` }} />
                </span>
                <span className="tabular-nums text-foreground">{format(year.amount)}</span>
                </span>
                </summary>
                <IncomePayments payments={income.payments.filter((payment) => payment.date.startsWith(String(year.year)))} currency={currency} instrumentsById={instrumentsById} />
                </details>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">{tr("Chi paga di più (ultimi 12 mesi)")}</p>
            <ul className="flex flex-col gap-1.5">
              {income.topInstruments.map((item) => (
                <li key={item.instrumentId} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-foreground">{instrumentsById.get(item.instrumentId)?.name ?? "Strumento"}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{format(item.trailing)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </PanelSection>
  );
}
