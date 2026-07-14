"use client";

/** Form "+ Aggiungi conto": crea un nuovo conto manuale con colore, icona e saldo formattato. */

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
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/validation/accounts";
import type { AccountColor, AccountIcon } from "@/lib/validation/accounts";
import { useCreateAccountMutation } from "@/lib/queries/accounts";
import { AccountAvatar } from "./account-avatar";
import { AccountIconColorPicker } from "./account-icon-color-picker";
import { CurrencyInput } from "./currency-input";
import { ConnectBankFlow } from "./connect-bank-flow";

const CUSTOM_TYPE_VALUE = "__custom__";

const DEFAULT_COLOR: AccountColor = "slate";
const DEFAULT_ICON: AccountIcon = "wallet";

export interface AddAccountFormProps {
  /** Valuta dell'utente (ISO 4217), usata per CurrencyInput. */
  currency: string;
  /** Forza il tab iniziale (usato dal bottone "Riconnetti" in AccountRow); di default "manuale". */
  mode?: "manuale" | "collega-banca";
}

export function AddAccountForm({ currency, mode: modeProp }: AddAccountFormProps) {
  const [mode, setMode] = React.useState<"manuale" | "collega-banca">(modeProp ?? "manuale");
  React.useEffect(() => {
    if (modeProp) setMode(modeProp);
  }, [modeProp]);

  const createMutation = useCreateAccountMutation();

  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<string>(ACCOUNT_TYPE_OPTIONS[0]);
  const [isCustomType, setIsCustomType] = React.useState(false);
  const [balanceValue, setBalanceValue] = React.useState<number | null>(0);
  const [color, setColor] = React.useState<AccountColor>(DEFAULT_COLOR);
  const [icon, setIcon] = React.useState<AccountIcon>(DEFAULT_ICON);
  const [error, setError] = React.useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (name.trim() === "" || type.trim() === "") {
      setError("Nome e tipo sono obbligatori");
      return;
    }
    if (balanceValue === null) {
      setError("Il saldo iniziale non è un numero valido");
      return;
    }

    createMutation.mutate(
      {
        name: name.trim(),
        type: type.trim(),
        balance: balanceValue,
        color,
        icon,
      },
      {
        onSuccess: () => {
          setName("");
          setType(ACCOUNT_TYPE_OPTIONS[0]);
          setIsCustomType(false);
          setBalanceValue(0);
          setColor(DEFAULT_COLOR);
          setIcon(DEFAULT_ICON);
        },
        onError: (mutationError) => setError(mutationError.message),
      }
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex gap-2 px-4 pt-3">
        <Button type="button" size="sm" variant={mode === "manuale" ? "default" : "outline"} onClick={() => setMode("manuale")}>
          Manuale
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "collega-banca" ? "default" : "outline"}
          onClick={() => setMode("collega-banca")}
        >
          Collega banca
        </Button>
      </div>

      {mode === "collega-banca" ? (
        <ConnectBankFlow />
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 border-t border-border p-4">
          <div className="flex items-end gap-2">
            <AccountIconColorPicker
              value={{ color, icon }}
              onChange={({ color: c, icon: i }) => {
                setColor(c);
                setIcon(i);
              }}
            >
              <AccountAvatar color={color} icon={icon} />
            </AccountIconColorPicker>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground" htmlFor="new-account-name">
              Nome
            </label>
            <Input id="new-account-name" value={name} onChange={(e) => setName(e.target.value)} className="w-40" />
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
            <CurrencyInput
              value={balanceValue}
              onChange={setBalanceValue}
              currency={currency}
              className="w-28"
              aria-label="Saldo iniziale"
            />
          </div>

          <Button type="submit" disabled={createMutation.isPending}>
            + Aggiungi conto
          </Button>

          {error && <p className="w-full text-sm text-destructive">{error}</p>}
        </form>
      )}
    </div>
  );
}
