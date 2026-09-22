"use client";

/** Pagina Conti: orchestra fetch, KPI, lista conti e form di creazione. Nessuna logica di business qui. */

import * as React from "react";
import { AccountsKpi, AccountRow, AddAccountForm } from "@/components/domain/accounts";
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
import { useAccountsQuery } from "@/lib/queries/accounts";
import { useBankConnectionsStatusQuery } from "@/lib/queries/gocardless";
import { Plus } from "lucide-react";

export default function ContiPage() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const { data: accounts, isLoading, isError, refetch } = useAccountsQuery();
  const { data: connectionStatuses } = useBankConnectionsStatusQuery();
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [reconnectTrigger, setReconnectTrigger] = React.useState(0);

  const reconnectAccountIds = new Set(
    (connectionStatuses ?? [])
      .filter((status) => status.status === "expired" || status.status === "error")
      .map((status) => status.accountId)
  );

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
        <AccountsKpi accounts={accounts ?? []} currency={currency} />
      )}

      <Card className="p-0 overflow-hidden">
        {!isLoading && !isError && (accounts ?? []).length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">
            Nessun conto ancora. Aggiungine uno usando il pulsante in alto.
          </p>
        ) : (
          !isLoading &&
          !isError &&
          (accounts ?? []).map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              currency={currency}
              needsReconnect={reconnectAccountIds.has(account.id)}
              syncInfo={syncInfoByAccountId.get(account.id)}
              onReconnect={() => {
                setReconnectTrigger((n) => n + 1);
                setCreateDialogOpen(true);
              }}
            />
          ))
        )}
      </Card>
    </div>
  );
}
