/**
 * AccountsKpi
 *
 * Riga di KPI per la schermata Conti: liquidità totale (mostrata anche come
 * "Patrimonio netto (solo liquidità)" finché Investimenti/Debiti/Immobile non
 * esistono come entità — vedi docs/superpowers/specs/2026-07-04-conti-screen-design.md)
 * e conteggio conti collegati.
 */

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { computeAccountsKpi } from "./accounts-kpi.utils";
import type { Account } from "@/lib/db/schema/accounts";

export interface AccountsKpiProps {
  accounts: Account[];
  /** Valuta dell'utente (ISO 4217), usata per formattare gli importi. */
  currency: string;
}

export function AccountsKpi({ accounts, currency }: AccountsKpiProps) {
  const { totalLiquidity, linkedAccountsCount } = computeAccountsKpi(accounts);
  const isNegative = totalLiquidity < 0;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-text-2">Liquidità totale</p>
      <span
        className={cn(
          "font-heading text-4xl font-semibold tracking-tight tabular-nums",
          isNegative ? "text-neg" : "text-foreground"
        )}
      >
        {formatCurrency(totalLiquidity, currency)}
      </span>
      <p className="text-sm text-text-2">
        {linkedAccountsCount === 0
          ? "Nessun conto ancora"
          : linkedAccountsCount === 1
          ? "Somma di 1 conto"
          : `Somma di ${linkedAccountsCount} conti`}
      </p>
    </div>
  );
}
