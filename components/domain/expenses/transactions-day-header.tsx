/** Intestazione di un giorno nella lista Movimenti: "Oggi"/"Ieri" o la data, con il totale effettivo della giornata. */

import { formatCurrency } from "@/lib/format";
import { relativeDayKind } from "@/lib/calc/transaction-groups";
import { cn } from "@/lib/utils";

export interface TransactionsDayHeaderProps {
  /** Data ISO `AAAA-MM-GG`. */
  date: string;
  /** Totale con segno degli importi effettivi del giorno. */
  net: number;
  currency: string;
  /** Riferimento per "oggi"/"ieri" (iniettabile per i test). */
  today?: Date;
  locale?: string;
}

const RELATIVE_LABELS = { oggi: "Oggi", ieri: "Ieri" } as const;

export function TransactionsDayHeader({ date, net, currency, today = new Date(), locale = "it-IT" }: TransactionsDayHeaderProps) {
  const kind = relativeDayKind(date, today);
  const [year, month, day] = date.split("-").map(Number);
  const label = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }).format(new Date(year, month - 1, day));
  return (
    <div className="sticky top-0 z-[1] flex items-baseline justify-between gap-3 border-b border-border bg-muted px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      <h3 className="font-semibold">
        {kind ? `${RELATIVE_LABELS[kind]} · ` : ""}
        {label}
      </h3>
      <span className={cn("tabular-nums", net > 0 && "text-pos")}>
        {net > 0 && "+"}
        {formatCurrency(net, currency)}
      </span>
    </div>
  );
}
