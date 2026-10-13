"use client";

/** Riga di un conto nella scheda Conti: avatar, nome, stato in parole, miniatura, saldo e scorciatoia ai movimenti. */

import * as React from "react";
import { AlertTriangleIcon, ListOrderedIcon, Loader2Icon } from "lucide-react";
import { AccountAvatar } from "@/components/domain/accounts";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AccountColor, AccountIcon } from "@/lib/validation/accounts";
import { Sparkline } from "./sparkline";

export interface AccountLineProps {
  name: string;
  type: string;
  color: AccountColor;
  icon: AccountIcon;
  balance: number;
  currency: string;
  /** Stato in parole ("Aggiornato 2 ore fa", "Da riconnettere"). */
  status: string;
  statusTone: "ok" | "neutral" | "progress" | "warning";
  trend?: readonly number[];
  onOpen: () => void;
  onShowMovements: () => void;
}

export function AccountLine({ name, type, color, icon, balance, currency, status, statusTone, trend, onOpen, onShowMovements }: AccountLineProps) {
  const StatusIcon = statusTone === "warning" ? AlertTriangleIcon : statusTone === "progress" ? Loader2Icon : null;
  return (
    <li className="flex items-stretch gap-1 rounded-2xl bg-foreground/[0.04]">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${name}, ${type}, ${formatCurrency(balance, currency)}. ${status}. Apri i dettagli`}
        className="flex min-h-[4.25rem] min-w-0 flex-1 items-center gap-3.5 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-foreground/[0.04] focus-visible:outline-2 focus-visible:outline-ring"
      >
        <AccountAvatar color={color} icon={icon} className="size-11" size={19} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{name}</span>
          <span className="block truncate text-sm text-text-2">{type}</span>
          <span className={cn("flex items-center gap-1 text-sm", statusTone === "warning" ? "font-medium text-neg" : statusTone === "progress" ? "text-primary" : "text-text-2")}>
            {StatusIcon && <StatusIcon className={cn("size-3.5 shrink-0", statusTone === "progress" && "motion-safe:animate-spin")} aria-hidden="true" />}
            {status}
          </span>
        </span>
        {trend && (
          <span className="hidden sm:block">
            <Sparkline values={trend} />
          </span>
        )}
        <span className={cn("shrink-0 font-heading text-lg font-semibold tabular-nums", balance < 0 && "text-neg")}>{formatCurrency(balance, currency)}</span>
      </button>
      <button
        type="button"
        onClick={onShowMovements}
        aria-label={`Vedi i movimenti di ${name}`}
        className="flex w-12 shrink-0 items-center justify-center rounded-2xl text-text-2 hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ListOrderedIcon className="size-5" aria-hidden="true" />
      </button>
    </li>
  );
}
