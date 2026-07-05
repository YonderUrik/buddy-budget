"use client";

/** Form "+ Aggiungi conto": crea un nuovo conto manuale. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACCOUNT_TYPE_OPTIONS, parseAmount } from "@/lib/validation/accounts";
import { useCreateAccountMutation } from "@/lib/queries/accounts";

const CUSTOM_TYPE_VALUE = "__custom__";

export function AddAccountForm() {
  const createMutation = useCreateAccountMutation();

  const [name, setName] = React.useState("");
  const [institution, setInstitution] = React.useState("");
  const [type, setType] = React.useState<string>(ACCOUNT_TYPE_OPTIONS[0]);
  const [isCustomType, setIsCustomType] = React.useState(false);
  const [balanceText, setBalanceText] = React.useState("0");
  const [error, setError] = React.useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (name.trim() === "" || type.trim() === "") {
      setError("Nome e tipo sono obbligatori");
      return;
    }
    const balance = parseAmount(balanceText);
    if (balance === null) {
      setError("Il saldo iniziale non è un numero valido");
      return;
    }

    createMutation.mutate(
      {
        name: name.trim(),
        institution: institution.trim() === "" ? undefined : institution.trim(),
        type: type.trim(),
        balance,
      },
      {
        onSuccess: () => {
          setName("");
          setInstitution("");
          setType(ACCOUNT_TYPE_OPTIONS[0]);
          setIsCustomType(false);
          setBalanceText("0");
        },
        onError: (mutationError) => setError(mutationError.message),
      }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 border-t border-border p-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground" htmlFor="new-account-name">
          Nome
        </label>
        <Input id="new-account-name" value={name} onChange={(e) => setName(e.target.value)} className="w-40" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground" htmlFor="new-account-institution">
          Istituto
        </label>
        <Input
          id="new-account-institution"
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
          className="w-40"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Tipo</label>
        <Select
          value={isCustomType ? CUSTOM_TYPE_VALUE : type}
          onValueChange={(value) => {
            if (value === CUSTOM_TYPE_VALUE) {
              setIsCustomType(true);
              setType("");
              return;
            }
            setIsCustomType(false);
            setType(value as string);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo conto" />
          </SelectTrigger>
          <SelectContent>
            {ACCOUNT_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM_TYPE_VALUE}>Altro…</SelectItem>
          </SelectContent>
        </Select>
        {isCustomType && (
          <Input
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="Tipo personalizzato"
            className="w-40"
          />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground" htmlFor="new-account-balance">
          Saldo iniziale
        </label>
        <Input
          id="new-account-balance"
          value={balanceText}
          onChange={(e) => setBalanceText(e.target.value)}
          className="w-28"
          inputMode="decimal"
        />
      </div>

      <Button type="submit" disabled={createMutation.isPending}>
        + Aggiungi conto
      </Button>

      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}
