"use client";

/** Pagina Conti: orchestra fetch, KPI, lista conti e form di creazione. Nessuna logica di business qui. */

import * as React from "react";
import {
  AccountsKpi,
  AccountsTrend,
  AccountRow,
  AddAccountForm,
  RenewalBanner,
  buildRenewalAlerts,
  computeAccountsKpi,
  groupAccounts,
} from "@/components/domain/accounts";
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
import { computeConnectionHealth } from "@/lib/gocardless/connection-health";
import { track } from "@/lib/analytics";
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

  // Il badge "Riconnetti" compare quando il collegamento non funziona già (anche se il cron non l'ha ancora segnato);
  // il banner anticipa di 7 giorni, quando il collegamento funziona ma sta per scadere.
  const reconnectAccountIds = new Set(
    (connectionStatuses ?? [])
      .filter((status) => {
        const { state } = computeConnectionHealth(status, today);
        return state === "expired" || state === "error";
      })
      .map((status) => status.accountId)
  );
  const renewalAlerts = buildRenewalAlerts(connectionStatuses ?? [], today);

  const openRenewDialog = React.useCallback((source: "banner" | "row" | "email") => {
    track("bank_renew_started", { source });
    setReconnectTrigger((n) => n + 1);
    setCreateDialogOpen(true);
  }, []);

  // Il link dell'email porta a /conti?rinnova=1: apre subito il flusso di rinnovo (una volta sola).
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("rinnova") !== "1") return;
    params.delete("rinnova");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    // Rimandato di un tick: aprire il dialog (setState) in modo sincrono dentro l'effetto causerebbe render a cascata.
    const timer = window.setTimeout(() => openRenewDialog("email"), 0);
    return () => window.clearTimeout(timer);
  }, [openRenewDialog]);

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

      <RenewalBanner alerts={renewalAlerts} onRenew={() => openRenewDialog("banner")} />

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
                    onReconnect={() => openRenewDialog("row")}
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
