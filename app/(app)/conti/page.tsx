"use client";

/** Pagina Conti: orchestra fetch, KPI, lista conti e form di creazione. Nessuna logica di business qui. */

import { AccountsKpi, AccountRow, AddAccountForm } from "@/components/domain/accounts";
import { Card } from "@/components/ui/card";
import { authClient } from "@/lib/auth/client";
import { useAccountsQuery } from "@/lib/queries/accounts";

export default function ContiPage() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const { data: accounts, isLoading, isError, refetch } = useAccountsQuery();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <h1 className="font-heading text-2xl font-medium text-foreground">Conti</h1>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Impossibile caricare i conti.{" "}
          <button onClick={() => refetch()} className="underline underline-offset-2">
            Riprova
          </button>
        </div>
      ) : (
        <AccountsKpi accounts={accounts ?? []} currency={currency} />
      )}

      <Card className="p-0">
        {!isLoading && !isError && (accounts ?? []).length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            Nessun conto ancora. Aggiungine uno dal form qui sotto.
          </p>
        ) : (
          !isLoading &&
          !isError &&
          (accounts ?? []).map((account) => (
            <AccountRow key={account.id} account={account} currency={currency} />
          ))
        )}
        <AddAccountForm />
      </Card>
    </div>
  );
}
