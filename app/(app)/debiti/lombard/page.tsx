"use client";

/** Lombard: le linee di credito (credit Lombard, fido) con utilizzo, interessi, andamento e registro. */

import * as React from "react";
import { CreditLineDetail, CreditLineSelector, DebtsViewGate, useDebtsActions } from "@/components/domain/debts";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { useDebtsQuery } from "@/lib/queries/debts";

const EMPTY_TITLE = "Nessuna linea di credito";
const EMPTY_TEXT = "Aggiungi un credit Lombard o un fido: vedrai quanto ne usi, quanto ti costa ogni mese e quando scatta la tua soglia di allerta.";

export default function LombardPage() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const { openAdd } = useDebtsActions();
  const query = useDebtsQuery();
  const data = query.data;
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const lines = data?.creditLines ?? [];
  const selected = lines.find((l) => l.id === selectedId) ?? lines[0];

  return (
    <DebtsViewGate loading={query.isLoading} error={query.isError} empty={false} onRetry={() => query.refetch()}>
      {selected ? (
        <>
          <CreditLineSelector lines={lines} selectedId={selected.id} onSelect={setSelectedId} currency={currency} />
          <CreditLineDetail key={selected.id} line={selected} currency={currency} onDeleted={() => setSelectedId(null)} />
        </>
      ) : (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="font-heading text-lg font-medium text-foreground">{EMPTY_TITLE}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{EMPTY_TEXT}</p>
          <Button className="mt-4" onClick={openAdd}>
            Aggiungi una linea di credito
          </Button>
        </div>
      )}
    </DebtsViewGate>
  );
}
