"use client";

/** Riga di un abbonamento: iniziale colorata, nome, cadenza e prossimo addebito, importo; sotto, le azioni rapide opzionali. */

import * as React from "react";
import { TrendingUpIcon } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { SubscriptionItem } from "@/lib/subscriptions/view";
import { cn } from "@/lib/utils";
import { initialOf, itemHint } from "./subscriptions-format";

/** Colori (token del tema) assegnati in modo stabile all'iniziale di ogni abbonamento. */
const AVATAR_COLORS = ["--swatch-blue", "--swatch-teal", "--swatch-purple", "--swatch-orange", "--swatch-pink", "--swatch-indigo", "--swatch-cyan", "--swatch-amber"] as const;

function avatarColor(key: string): string {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `var(${AVATAR_COLORS[hash % AVATAR_COLORS.length]})`;
}

export interface SubscriptionRowProps {
  item: SubscriptionItem;
  currency: string;
  /** Data di oggi (`YYYY-MM-DD`), per dire «tra 5 giorni». */
  today: string;
  onOpen: (item: SubscriptionItem) => void;
  /** Azioni rapide sotto la riga (es. Conferma / Non lo è). */
  actions?: React.ReactNode;
  className?: string;
}

export function SubscriptionRow({ item, currency, today, onOpen, actions, className }: SubscriptionRowProps) {
  const color = avatarColor(item.key);
  const showMonthly = item.cadence !== null && item.cadence !== "mensile" && item.monthly !== null;
  const rise = item.priceChange && item.priceChange.to > item.priceChange.from ? item.priceChange : null;
  return (
    <div className={cn("rounded-2xl bg-foreground/[0.04]", className)}>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="flex min-h-16 w-full cursor-pointer items-center gap-3.5 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-foreground/[0.04] focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={`${item.name}: apri i dettagli`}
      >
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full font-heading text-base font-medium" style={{ color, backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)` }}>
          {initialOf(item.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{item.name}</span>
          <span className="block text-sm text-text-2">{itemHint(item, today)}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-mono font-semibold tabular-nums">{item.amount !== null ? formatCurrency(item.amount, currency) : "—"}</span>
          {rise ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-neg">
              <TrendingUpIcon className="size-3.5" aria-hidden="true" />
              era {formatCurrency(rise.from, currency)}
            </span>
          ) : showMonthly ? (
            <span className="block text-xs text-text-2">{formatCurrency(item.monthly ?? 0, currency)}/mese</span>
          ) : null}
        </span>
      </button>
      {actions ? <div className="flex flex-wrap gap-2 px-4 pb-3 pl-[4.25rem]">{actions}</div> : null}
    </div>
  );
}

