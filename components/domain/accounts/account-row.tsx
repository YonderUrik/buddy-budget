"use client";

/**
 * AccountRow
 *
 * Riga di un conto nella lista Conti: avatar, nome, tipo, stato in parole e saldo. Tutta la riga è un unico bersaglio
 * (≥ 56 px) che apre i dettagli, dove si modifica o si rimuove il conto; accanto c'è il collegamento ai movimenti.
 * Non modifica nulla da sola: modifiche, sync e rimozione vivono in `AccountDetailsDialog`.
 */

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, ListOrdered, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { Account } from "@/lib/db/schema/accounts";
import type { AccountColor, AccountIcon } from "@/lib/validation/accounts";
import { AccountAvatar } from "./account-avatar";
import { buildAccountStatus, type AccountStatusTone, type AccountSyncInfo } from "./account-status";

export interface AccountRowProps {
  account: Account;
  /** Valuta dell'utente (ISO 4217), usata per formattare il saldo. */
  currency: string;
  /** True se il consenso bancario collegato a questo conto è scaduto/in errore. */
  needsReconnect?: boolean;
  /** Info di sync (solo per conti collegati). */
  syncInfo?: AccountSyncInfo;
  /** True se il conto ha un sync in corso (anche partito da un'altra pagina o scheda). */
  syncing?: boolean;
  /** Se presente, accanto alla riga compare il collegamento ai movimenti di questo conto. */
  movementsHref?: string;
  /** Chiamato quando l'utente apre i dettagli del conto. */
  onOpen: () => void;
}

const TONE_CLASS: Record<AccountStatusTone, string> = {
  ok: "text-text-2",
  neutral: "text-text-2",
  progress: "text-primary",
  warning: "font-medium text-destructive",
};

export function AccountRow({ account, currency, needsReconnect, syncInfo, syncing, movementsHref, onOpen }: AccountRowProps) {
  const isAuto = account.source === "auto";
  const status = buildAccountStatus({ isAuto, needsReconnect, syncing, syncInfo });
  const balance = Number(account.balance);
  const StatusIcon = status.tone === "warning" ? AlertTriangle : status.tone === "progress" ? Loader2 : null;

  return (
    <li className="flex items-stretch border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${account.name}, ${account.type}, ${formatCurrency(balance, currency)}. ${status.label}. Apri i dettagli`}
        className="group flex min-h-16 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <AccountAvatar color={account.color as AccountColor} icon={account.icon as AccountIcon} className="size-10" size={18} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[15px] font-medium text-foreground">{account.name}</span>
            <span
              className={cn(
                "shrink-0 font-heading text-base font-semibold tabular-nums sm:text-lg",
                balance < 0 ? "text-neg" : "text-foreground"
              )}
            >
              {formatCurrency(balance, currency)}
            </span>
          </span>
          <span className="block truncate text-sm text-text-2">{account.type}</span>
          <span className={cn("mt-0.5 flex items-center gap-1 text-[13px]", TONE_CLASS[status.tone])}>
            {StatusIcon && <StatusIcon size={13} aria-hidden className={cn("shrink-0", status.tone === "progress" && "motion-safe:animate-spin")} />}
            <span>{status.label}</span>
          </span>
        </span>
        <ChevronRight size={18} aria-hidden className="hidden shrink-0 sm:block text-text-3 transition-transform group-hover:translate-x-0.5" />
      </button>
      {movementsHref && (
        <Link
          href={movementsHref}
          aria-label={`Vedi i movimenti di ${account.name}`}
          className="flex w-12 shrink-0 items-center justify-center rounded-lg text-text-2 outline-none transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <ListOrdered size={18} aria-hidden />
        </Link>
      )}
    </li>
  );
}
