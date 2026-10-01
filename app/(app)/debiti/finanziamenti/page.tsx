"use client";

/** Finanziamenti: l'elenco dei debiti e, per quello scelto, piano, eventi e azioni. */

import * as React from "react";
import { DebtDetail, DebtSelector, DebtsViewGate } from "@/components/domain/debts";
import { authClient } from "@/lib/auth/client";
import { useDebtsQuery } from "@/lib/queries/debts";

export default function FinanziamentiPage() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const query = useDebtsQuery();
  const data = query.data;
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selected = data?.debts.find((d) => d.id === selectedId) ?? data?.debts[0];

  return (
    <DebtsViewGate loading={query.isLoading} error={query.isError} empty={data?.debts.length === 0} onRetry={() => query.refetch()}>
      {data && selected ? (
        <>
          <DebtSelector debts={data.debts} selectedId={selected.id} onSelect={setSelectedId} currency={currency} />
          <DebtDetail key={selected.id} debt={selected} currency={currency} onDeleted={() => setSelectedId(null)} />
        </>
      ) : null}
    </DebtsViewGate>
  );
}
