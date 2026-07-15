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
    <div className="flex flex-col gap-0.5 px-1">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Liquidità totale
      </p>
      <div className="flex flex-wrap items-baseline gap-2">
        <span
          className={cn(
            "font-heading text-3xl sm:text-4xl font-semibold tracking-tight tabular-nums",
            isNegative ? "text-neg" : "text-pos"
          )}
        >
          {formatCurrency(totalLiquidity, currency)}
        </span>
        <span className="text-xs text-muted-foreground font-normal">
          {linkedAccountsCount === 0
            ? "• nessun conto collegato"
            : linkedAccountsCount === 1
            ? "• su 1 conto attivo"
            : `• su ${linkedAccountsCount} conti attivi`}
        </span>
      </div>
    </div>
  );
}
