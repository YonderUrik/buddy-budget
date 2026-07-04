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
import { ACCOUNT_TYPE_OPTIONS, parseAmount } from "@/lib/validation/accounts";
import { useDeleteAccountMutation, useUpdateAccountMutation } from "@/lib/queries/accounts";
import type { UpdateAccountInput } from "@/lib/validation/accounts";
import type { Account } from "@/lib/db/schema/accounts";
import { cn } from "@/lib/utils";

const CUSTOM_TYPE_VALUE = "__custom__";

function initialsFor(text: string): string {
  return text
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export interface AccountRowProps {
  account: Account;
  /** Valuta dell'utente (ISO 4217), usata per formattare il saldo. */
  currency: string;
}

export function AccountRow({ account, currency }: AccountRowProps) {
  const isAuto = account.source === "auto";
  const updateMutation = useUpdateAccountMutation();
  const deleteMutation = useDeleteAccountMutation();

  const [name, setName] = React.useState(account.name);
  const [institution, setInstitution] = React.useState(account.institution ?? "");
  const [type, setType] = React.useState(account.type);
  const [balanceText, setBalanceText] = React.useState(account.balance);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const isCustomType = !ACCOUNT_TYPE_OPTIONS.includes(
    type as (typeof ACCOUNT_TYPE_OPTIONS)[number]
  );

  function commitField(field: "name" | "institution" | "type" | "balance", rawValue: string) {
    if (field === "balance") {
      const parsed = parseAmount(rawValue);
      if (parsed === null || parsed === Number(account.balance)) return;
      updateMutation.mutate({ id: account.id, input: { balance: parsed } });
      return;
    }
    if (rawValue === (account[field] ?? "")) return;
    const input: UpdateAccountInput = { [field]: rawValue } as UpdateAccountInput;
    updateMutation.mutate({ id: account.id, input });
  }

  function handleDeleteConfirm() {
    deleteMutation.mutate(account.id);
    setDialogOpen(false);
  }

  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
        aria-hidden="true"
      >
        {initialsFor(account.institution || account.name)}
      </div>

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
            <span>
              {account.institution ? `${account.institution} · ` : ""}
              {account.type}
            </span>
          ) : (
            <>
              <Input
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                onBlur={() => commitField("institution", institution)}
                placeholder="Istituto"
                className="h-6 w-32 text-xs"
                aria-label="Istituto"
              />
              <Select
                value={isCustomType ? CUSTOM_TYPE_VALUE : type}
                onValueChange={(value) => {
                  if (value === null || value === CUSTOM_TYPE_VALUE) return;
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

      {isAuto ? (
        <p className="w-28 shrink-0 text-right text-sm font-medium tabular-nums">
          {formatCurrency(Number(account.balance), currency)}
        </p>
      ) : (
        <Input
          value={balanceText}
          onChange={(e) => setBalanceText(e.target.value)}
          onBlur={() => commitField("balance", balanceText)}
          className="h-7 w-28 text-right text-sm font-medium tabular-nums"
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
