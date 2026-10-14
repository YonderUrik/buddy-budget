"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";
/** Un'azione che hai sia direttamente sia dentro i tuoi ETF: barra con le due parti e il totale. */

import type { Instrument } from "@/lib/db/schema/investments";
import { InstrumentLabel } from "../instrument-label";

import type { StockInsideFunds } from "@/lib/investments/overlap";

export interface StockInFundsRowProps {
  item: StockInsideFunds;
  nameOf: (id: string) => string;
  instrumentOf: (id: string) => Pick<Instrument, "id" | "name" | "type"> | undefined;
  currency: string;
}



export function StockInFundsRow({ item, nameOf, instrumentOf, currency }: StockInFundsRowProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);
  function money(value: number, currency: string): string {
  return formatCurrency(value, currency, { maximumFractionDigits: 0 });
}

  const { t: tr } = useLocalization();
  const stock = instrumentOf(item.stockId);
  const via = item.totalValue - item.directValue;
  const directShare = item.totalValue > 0 ? item.directValue / item.totalValue : 1;
  return (
    <li className="flex flex-col gap-2 rounded-xl border p-3">
      <p className="text-sm text-foreground">
        <span className="font-medium">{stock ? <InstrumentLabel instrument={stock} className="max-w-full" /> : "—"}</span>{" "}{tr("pesa in tutto")}{" "}
        <span className="font-medium tabular-nums">{money(item.totalValue, currency)}</span>{tr(", perché la hai anche dentro")}{" "}
        {item.funds.length === 1 ? tr("un ETF") : tr("{0} ETF", {0: item.funds.length})}{"."}</p>
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
        <div className="h-full bg-[var(--swatch-blue)]" style={{ width: `${directShare * 100}%` }} />
        <div className="h-full flex-1 bg-[var(--swatch-amber)]" />
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="tabular-nums">{money(item.directValue, currency)}</span>{" "}{tr("come azioni ·")}{" "}<span className="tabular-nums">{money(via, currency)}</span>{" "}{tr("dentro gli ETF (")}{item.funds.map((f) => tr("{0}% di {1}", { 0: (f.weightInFund * 100).toFixed(1).replace(".", ","), 1: nameOf(f.fundId) })).join(", ")}{")"}</p>
    </li>
  );
}
