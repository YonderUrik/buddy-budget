/**
 * AccountsKpi
 *
 * Riga di KPI per la schermata Conti: liquidità totale (mostrata anche come
 * "Patrimonio netto (solo liquidità)" finché Investimenti/Debiti/Immobile non
 * esistono come entità — vedi docs/superpowers/specs/2026-07-04-conti-screen-design.md)
 * e conteggio conti collegati.
 */

import { StatCard } from "@/components/domain/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeAccountsKpi } from "./accounts-kpi.utils";
import type { Account } from "@/lib/db/schema/accounts";

export interface AccountsKpiProps {
  accounts: Account[];
  /** Valuta dell'utente (ISO 4217), usata per formattare gli importi. */
  currency: string;
}

export function AccountsKpi({ accounts, currency }: AccountsKpiProps) {
  const { totalLiquidity, linkedAccountsCount } = computeAccountsKpi(accounts);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard label="Liquidità totale" value={totalLiquidity} currency={currency} />
      <StatCard
        label="Patrimonio netto (solo liquidità)"
        value={totalLiquidity}
        currency={currency}
        subtitle="Non include ancora investimenti, debiti o immobili"
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Conti collegati
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-heading text-3xl font-medium tabular-nums">{linkedAccountsCount}</p>
        </CardContent>
      </Card>
    </div>
  );
}
