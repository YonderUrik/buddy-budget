"use client";

/**
 * AccountRow
 *
 * Riga singola nella lista Conti. Conti manuali: nome/istituto/tipo/saldo
 * editabili inline (salvataggio on-blur) + eliminazione con conferma. Conti
 * auto: campi in sola lettura + azione "Scollega" con conferma (nessuna
 * integrazione bancaria reale dietro per ora — vedi spec).
 */

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatCurrency } from "@/lib/format";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/validation/accounts";
import { useDeleteAccountMutation, useUpdateAccountMutation } from "@/lib/queries/accounts";
import type { UpdateAccountInput } from "@/lib/validation/accounts";
import type { AccountColor, AccountIcon } from "@/lib/validation/accounts";
import type { Account } from "@/lib/db/schema/accounts";
import { cn } from "@/lib/utils";
import { AccountAvatar } from "./account-avatar";
import { AccountIconColorPicker } from "./account-icon-color-picker";
import { CurrencyInput } from "./currency-input";

const CUSTOM_TYPE_VALUE = "__custom__";

export interface AccountRowProps {
  account: Account;
  /** Valuta dell'utente (ISO 4217), usata per formattare il saldo. */
  currency: string;
  /** True se il consenso bancario collegato a questo conto è scaduto/in errore. */
  needsReconnect?: boolean;
  /** Chiamato quando l'utente clicca "Riconnetti". */
  onReconnect?: () => void;
}

export function AccountRow({ account, currency, needsReconnect, onReconnect }: AccountRowProps) {
  const isAuto = account.source === "auto";
  const updateMutation = useUpdateAccountMutation();
  const deleteMutation = useDeleteAccountMutation();

  const [name, setName] = React.useState(account.name);
  const [type, setType] = React.useState(account.type);
  const [balanceValue, setBalanceValue] = React.useState<number | null>(Number(account.balance));
  const [color, setColor] = React.useState<AccountColor>(account.color as AccountColor);
  const [icon, setIcon] = React.useState<AccountIcon>(account.icon as AccountIcon);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [isCustomType, setIsCustomType] = React.useState(
    () =>
      !ACCOUNT_TYPE_OPTIONS.includes(account.type as (typeof ACCOUNT_TYPE_OPTIONS)[number])
  );

  function commitField(field: keyof UpdateAccountInput, value: string | number | null) {
    if (field === "balance") {
      const num = typeof value === "number" ? value : null;
      if (num === null || num === Number(account.balance)) return;
      updateMutation.mutate({ id: account.id, input: { balance: num } });
      return;
    }
    if (typeof value === "string" && value === (account[field as "name" | "type"] ?? "")) return;
    const input: UpdateAccountInput = { [field]: value } as UpdateAccountInput;
    updateMutation.mutate({ id: account.id, input });
  }

  function handleAppearanceChange(next: { color: AccountColor; icon: AccountIcon }) {
    if (next.color !== color) {
      setColor(next.color);
      updateMutation.mutate({ id: account.id, input: { color: next.color } });
    }
    if (next.icon !== icon) {
      setIcon(next.icon);
      updateMutation.mutate({ id: account.id, input: { icon: next.icon } });
    }
  }

  function handleDeleteConfirm() {
    deleteMutation.mutate(account.id);
    setDialogOpen(false);
  }

  const avatar = <AccountAvatar color={color} icon={icon} />;

  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      {isAuto ? (
        avatar
      ) : (
        <AccountIconColorPicker
          value={{ color, icon }}
          onChange={handleAppearanceChange}
        >
          {avatar}
        </AccountIconColorPicker>
      )}

      <div className="min-w-0 flex-1 space-y-1">
        {isAuto ? (
          <p className="truncate text-sm font-medium text-foreground">{account.name}</p>
        ) : (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => commitField("name", name)}
            className="h-7 text-sm font-medium"
            aria-label="Nome conto"
          />
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {isAuto ? (
            <span>{account.type}</span>
          ) : (
            <>
              <Select
                value={isCustomType ? CUSTOM_TYPE_VALUE : type}
                onValueChange={(value) => {
                  if (value === null) return;
                  if (value === CUSTOM_TYPE_VALUE) {
                    setIsCustomType(true);
                    return;
                  }
                  setIsCustomType(false);
                  setType(value);
                  commitField("type", value);
                }}
              >
                <SelectTrigger size="sm" className="h-6 text-xs">
                  <SelectValue placeholder="Tipo" />
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
                  onBlur={() => commitField("type", type)}
                  placeholder="Tipo personalizzato"
                  className="h-6 w-32 text-xs"
                  aria-label="Tipo personalizzato"
                />
              )}
            </>
          )}
        </div>
      </div>

      <Badge variant={isAuto ? "secondary" : "outline"}>{isAuto ? "Auto" : "Manuale"}</Badge>

      {needsReconnect && (
        <button
          type="button"
          onClick={onReconnect}
          className="shrink-0 rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/20"
        >
          Riconnetti
        </button>
      )}

      {isAuto ? (
        <p className="w-28 shrink-0 text-right text-sm font-medium tabular-nums">
          {formatCurrency(Number(account.balance), currency)}
        </p>
      ) : (
        <CurrencyInput
          value={balanceValue}
          onChange={setBalanceValue}
          onBlur={() => commitField("balance", balanceValue)}
          currency={currency}
          className="w-28 text-right"
          aria-label="Saldo"
        />
      )}

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogTrigger
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground",
            "hover:bg-destructive/10 hover:text-destructive"
          )}
          aria-label={isAuto ? "Scollega conto" : "Rimuovi conto"}
        >
          ✕
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isAuto ? "Scollegare questo conto?" : "Eliminare questo conto?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isAuto
                ? `"${account.name}" verrà scollegato. L'azione non è reversibile.`
                : `"${account.name}" verrà eliminato definitivamente, insieme al suo saldo registrato.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              {isAuto ? "Scollega" : "Elimina"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
