"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/** Riga di un conto nella scheda Conti: avatar, nome, stato in parole, miniatura, saldo e scorciatoia ai movimenti. */

import * as React from "react";
import { AlertTriangleIcon, ListOrderedIcon, Loader2Icon } from "lucide-react";
import { AccountAvatar } from "@/components/domain/accounts";

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
  /** Groups the account is shown to («Noi due»): a line under the status. */
  sharedWith?: readonly string[];
  onOpen: () => void;
  onShowMovements: () => void;
}

export function AccountLine({ name, type, color, icon, balance, currency, status, statusTone, trend, sharedWith, onOpen, onShowMovements }: AccountLineProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const StatusIcon = statusTone === "warning" ? AlertTriangleIcon : statusTone === "progress" ? Loader2Icon : null;
  return (
    <li className="flex items-stretch gap-1 rounded-2xl bg-foreground/[0.04]">
      <button
        type="button"
        onClick={onOpen}
        aria-label={tr("{0}, {1}, {2}. {3}. Apri i dettagli", {0: name, 1: type, 2: formatCurrency(balance, currency), 3: status})}
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
          {sharedWith && sharedWith.length > 0 ? (
            <span className="block truncate text-sm text-primary">{tr("In comune: {0}", { 0: sharedWith.map((g) => `«${g}»`).join(", ") })}</span>
          ) : null}
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
        aria-label={tr("Vedi i movimenti di {0}", {0: name})}
        className="flex w-12 shrink-0 items-center justify-center rounded-2xl text-text-2 hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ListOrderedIcon className="size-5" aria-hidden="true" />
      </button>
    </li>
  );
}
