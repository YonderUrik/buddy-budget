"use client";

/** Pagina di selezione dei conti trovati dopo il consenso GoCardless: crea nuovi conti o ricollega uno esistente. */

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConnectionAccountsQuery, useFinalizeConnectionMutation } from "@/lib/queries/gocardless";
import type { FinalizeSelectionInput } from "@/lib/validation/gocardless";

const NEW_ACCOUNT_VALUE = "__new__";

export default function CollegaBancaPage() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const router = useRouter();
  const { data, isLoading, isError } = useConnectionAccountsQuery(connectionId);
  const finalize = useFinalizeConnectionMutation(connectionId);

  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const [targets, setTargets] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    const selections: FinalizeSelectionInput["selections"] = (data?.externalAccounts ?? [])
      .filter((account) => selected[account.externalAccountId])
      .map((account) => {
        const target = targets[account.externalAccountId] ?? NEW_ACCOUNT_VALUE;
        return target === NEW_ACCOUNT_VALUE
          ? {
              externalAccountId: account.externalAccountId,
              name: account.details.name ?? account.details.iban ?? "Conto collegato",
              type: "Conto corrente",
              mode: "new" as const,
            }
          : {
              externalAccountId: account.externalAccountId,
              name: account.details.name ?? "Conto collegato",
              type: "Conto corrente",
              mode: "existing" as const,
              existingAccountId: target,
            };
      });

    if (selections.length === 0) {
      setError("Seleziona almeno un conto da importare");
      return;
    }

    finalize.mutate(
      { selections },
      {
        onSuccess: () => router.push("/conti"),
        onError: (mutationError) => setError(mutationError.message),
      }
    );
  }

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Caricamento conti trovati…</p>;
  if (isError || !data) {
    return <p className="p-6 text-sm text-destructive">Impossibile caricare i conti trovati.</p>;
  }
  if (data.externalAccounts.length === 0) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        La banca non ha condiviso nessun conto. Riprova il collegamento se pensi sia un errore.
      </p>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="font-heading text-2xl font-medium text-foreground">Conti trovati</h1>
      <p className="text-sm text-muted-foreground">
        Seleziona quali conti importare. Puoi crearne di nuovi o ricollegarli a un conto già esistente.
      </p>

      <div className="flex flex-col gap-3">
        {data.externalAccounts.map((account) => (
          <div key={account.externalAccountId} className="flex items-center gap-3 rounded-xl border border-border p-3">
            <Checkbox
              checked={selected[account.externalAccountId] ?? false}
              onCheckedChange={(checked) =>
                setSelected((prev) => ({ ...prev, [account.externalAccountId]: checked === true }))
              }
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {account.details.name ?? account.details.iban ?? account.externalAccountId}
              </p>
              {account.details.iban && <p className="text-xs text-muted-foreground">{account.details.iban}</p>}
            </div>
            <Select
              value={targets[account.externalAccountId] ?? NEW_ACCOUNT_VALUE}
              onValueChange={(value) =>
                setTargets((prev) => ({ ...prev, [account.externalAccountId]: value as string }))
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_ACCOUNT_VALUE}>Crea nuovo conto</SelectItem>
                {data.existingAutoAccounts.map((existing) => (
                  <SelectItem key={existing.id} value={existing.id}>
                    Ricollega a &quot;{existing.name}&quot;
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <Button onClick={handleConfirm} disabled={finalize.isPending}>
        Conferma
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
