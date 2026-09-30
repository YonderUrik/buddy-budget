"use client";

/** Pagina Conti: orchestra fetch, KPI, lista conti e form di creazione. Nessuna logica di business qui. */

import * as React from "react";
import { AccountsKpi, AccountsTrend, AccountRow, AddAccountForm, computeAccountsKpi, groupAccounts } from "@/components/domain/accounts";
import { MOVEMENTS_ACCOUNT_PARAM } from "@/components/domain/movements";
import { LoadError } from "@/components/domain/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth/client";
import { buildNetWorthSeries, toDateKey } from "@/lib/calc/net-worth";
import { startOfDay } from "@/lib/calc/expenses";
import { useAccountsQuery } from "@/lib/queries/accounts";
import { useNetWorthSnapshotsQuery } from "@/lib/queries/net-worth";
import { useBankConnectionsStatusQuery } from "@/lib/queries/gocardless";
import { useSyncJobsQuery } from "@/lib/queries/sync-jobs";
import { isAccountSyncing } from "@/lib/sync-jobs/view";
import { Plus } from "lucide-react";

/** Giorni di storia mostrati nel mini andamento della liquidità. */
const TREND_DAYS = 30;

export default function ContiPage() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const { data: accounts, isLoading, isError, refetch } = useAccountsQuery();
  const { data: connectionStatuses } = useBankConnectionsStatusQuery();
  const { data: syncJobs } = useSyncJobsQuery();
  const today = React.useMemo(() => startOfDay(new Date()), []);
  const trendFrom = React.useMemo(() => toDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - TREND_DAYS - 1)), [today]);
  const { data: snapshots } = useNetWorthSnapshotsQuery(trendFrom, toDateKey(today));
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [reconnectTrigger, setReconnectTrigger] = React.useState(0);

  const reconnectAccountIds = new Set(
    (connectionStatuses ?? [])
      .filter((status) => status.status === "expired" || status.status === "error")
      .map((status) => status.accountId)
  );

  const bankByAccountId = new Map((connectionStatuses ?? []).map((status) => [status.accountId, status.institutionName]));
  const accountGroups = groupAccounts(accounts ?? [], bankByAccountId);
  const trendValues = buildNetWorthSeries(
    (snapshots ?? []).filter((row) => row.assetClass === "liquidita"),
    { liquidita: computeAccountsKpi(accounts ?? []).totalLiquidity },
    "1mese",
    today
  ).map((point) => point.value);

  const syncInfoByAccountId = new Map(
    (connectionStatuses ?? []).map((status) => [
      status.accountId,
      {
        lastSyncedAt: status.lastSyncedAt,
        eligible: status.eligible,
        nextEligibleAt: status.nextEligibleAt,
        syncsRemainingToday: status.syncsRemainingToday,
      },
    ])
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-4 sm:gap-6 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-medium text-foreground">Conti</h1>
        <Dialog open={createDialogOpen} onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            setReconnectTrigger(0);
          }
        }}>
          <DialogTrigger render={<Button size="sm" className="cursor-pointer gap-1.5 shadow-xs"><Plus size={15} /> Aggiungi conto</Button>} />
          <DialogContent className="max-w-md p-0 overflow-hidden">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle>Nuovo Conto</DialogTitle>
            </DialogHeader>
            <AddAccountForm
              key={reconnectTrigger}
              currency={currency}
              mode={reconnectTrigger > 0 ? "collega-banca" : undefined}
              onSuccess={() => setCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4" aria-busy="true">
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : isError ? (
        <LoadError message="Impossibile caricare i conti." onRetry={() => refetch()} />
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <AccountsKpi accounts={accounts ?? []} currency={currency} />
          <AccountsTrend values={trendValues} currency={currency} className="ml-auto" />
        </div>
      )}

      {!isLoading && !isError && (accounts ?? []).length === 0 ? (
        <Card className="p-0 overflow-hidden">
          <p className="p-6 text-sm text-muted-foreground text-center">
            Nessun conto ancora. Aggiungine uno usando il pulsante in alto.
          </p>
        </Card>
      ) : (
        !isLoading &&
        !isError &&
        accountGroups.map((section) => {
          const sectionAccounts = section.accounts;
          return (
            <section key={section.key} className="flex flex-col gap-2" aria-labelledby={`conti-${section.key}`}>
              <div className="flex items-baseline justify-between px-1">
                <h2 id={`conti-${section.key}`} className="text-sm font-medium text-foreground">
                  {section.label}
                </h2>
                <span className="text-xs text-muted-foreground">{section.hint}</span>
              </div>
              <Card className="p-0 overflow-hidden">
                {sectionAccounts.map((account) => (
                  <AccountRow
                    key={account.id}
                    account={account}
                    currency={currency}
                    needsReconnect={reconnectAccountIds.has(account.id)}
                    syncInfo={syncInfoByAccountId.get(account.id)}
                    syncing={isAccountSyncing(syncJobs ?? [], account.id)}
                    movementsHref={`/movimenti?${MOVEMENTS_ACCOUNT_PARAM}=${account.id}`}
                    onReconnect={() => {
                      setReconnectTrigger((n) => n + 1);
                      setCreateDialogOpen(true);
                    }}
                  />
                ))}
              </Card>
            </section>
          );
        })
      )}
    </div>
  );
}
