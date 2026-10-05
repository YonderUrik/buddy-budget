/** Un'azione che hai sia direttamente sia dentro i tuoi ETF: barra con le due parti e il totale. */

import { formatCurrency } from "@/lib/format";
import type { StockInsideFunds } from "@/lib/investments/overlap";

export interface StockInFundsRowProps {
  item: StockInsideFunds;
  nameOf: (id: string) => string;
  currency: string;
}

function money(value: number, currency: string): string {
  return formatCurrency(value, currency, { maximumFractionDigits: 0 });
}

export function StockInFundsRow({ item, nameOf, currency }: StockInFundsRowProps) {
  const via = item.totalValue - item.directValue;
  const directShare = item.totalValue > 0 ? item.directValue / item.totalValue : 1;
  return (
    <li className="flex flex-col gap-2 rounded-xl border p-3">
      <p className="text-sm text-foreground">
        <span className="font-medium">{nameOf(item.stockId)}</span> pesa in tutto{" "}
        <span className="font-medium tabular-nums">{money(item.totalValue, currency)}</span>, perché la hai anche dentro{" "}
        {item.funds.length === 1 ? "un ETF" : `${item.funds.length} ETF`}.
      </p>
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
        <div className="h-full bg-[var(--swatch-blue)]" style={{ width: `${directShare * 100}%` }} />
        <div className="h-full flex-1 bg-[var(--swatch-amber)]" />
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="tabular-nums">{money(item.directValue, currency)}</span> come azioni · <span className="tabular-nums">{money(via, currency)}</span>{" "}
        dentro gli ETF ({item.funds.map((f) => `${(f.weightInFund * 100).toFixed(1).replace(".", ",")}% di ${nameOf(f.fundId)}`).join(", ")})
      </p>
    </li>
  );
}
