"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/**
 * AccountDetailsDialog
 *
 * Dettagli di un conto in una finestra (a tutta larghezza sul telefono): nome, aspetto e, per i conti manuali, tipo e saldo
 * si salvano da soli; per i conti collegati tipo e saldo sono in sola lettura e ci sono sincronizzazione, riconnessione e
 * scollegamento. Le azioni distruttive chiedono sempre conferma.
 */

import { FormDialogContent } from "@/components/domain/shared";
import * as React from "react";
import Link from "next/link";
import { Link2Off, ListOrdered, RefreshCw, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

import { ACCOUNT_TYPE_OPTIONS } from "@/lib/validation/accounts";
import type { AccountColor, AccountIcon, UpdateAccountInput } from "@/lib/validation/accounts";
import { useDeleteAccountMutation, useUpdateAccountMutation } from "@/lib/queries/accounts";
import { useSyncAccountMutation } from "@/lib/queries/gocardless";
import type { Account } from "@/lib/db/schema/accounts";
import { AccountAvatar } from "./account-avatar";
import { AccountIconColorPicker } from "./account-icon-color-picker";
import { CurrencyInput } from "./currency-input";
import { localizedAccountStatus, type AccountSyncInfo } from "./account-status";
import { describeAccountProgress } from "@/components/domain/sync";
import type { SyncJobAccount } from "@/lib/sync-jobs/types";

const CUSTOM_TYPE_VALUE = "__custom__";
const FIELD_LABEL = "text-sm font-medium text-foreground";
const TALL_CONTROL = "h-11 sm:h-9";

export interface AccountDetailsDialogProps {
  /** Conto da mostrare; `null` tiene la finestra chiusa. */
  account: Account | null;
  /** Valuta dell'utente (ISO 4217). */
  currency: string;
  needsReconnect?: boolean;
  syncInfo?: AccountSyncInfo;
  syncing?: boolean;
  /** Latest sync of this account (progress or result), so the window itself says when and how a sync ended. */
  syncResult?: { account: SyncJobAccount; interrupted: boolean } | null;
  movementsHref?: string;
  /** Chiamato alla chiusura (anche dopo la rimozione del conto). */
  onClose: () => void;
  /** Chiamato da "Riconnetti la banca". */
  onReconnect?: () => void;
}

/** Contenuto della finestra: rimontato a ogni conto (key) così i campi ripartono dai valori salvati. */
function AccountDetailsBody({
  account,
  currency,
  needsReconnect,
  syncInfo,
  syncing = false,
  syncResult = null,
  movementsHref,
  onClose,
  onReconnect,
}: Omit<AccountDetailsDialogProps, "account"> & { account: Account }) {
  const { buildAccountStatus, describeSyncAvailability } = localizedAccountStatus(useLocalization().language);

  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const isAuto = account.source === "auto";
  const updateMutation = useUpdateAccountMutation();
  const deleteMutation = useDeleteAccountMutation();
  const syncMutation = useSyncAccountMutation(syncInfo?.provider);

  const [name, setName] = React.useState(account.name);
  const [type, setType] = React.useState(account.type);
  const [balanceValue, setBalanceValue] = React.useState<number | null>(Number(account.balance));
  const [color, setColor] = React.useState<AccountColor>(account.color as AccountColor);
  const [icon, setIcon] = React.useState<AccountIcon>(account.icon as AccountIcon);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [isCustomType, setIsCustomType] = React.useState(
    () => !ACCOUNT_TYPE_OPTIONS.includes(account.type as (typeof ACCOUNT_TYPE_OPTIONS)[number])
  );

  const kind = isAuto ? "collegato" : "manuale";
  const status = buildAccountStatus({ isAuto, needsReconnect, syncing, syncInfo });
  const syncDisabled = !syncInfo?.eligible || syncMutation.isPending || syncing || needsReconnect;

  function save(field: "name" | "type" | "balance" | "appearance", input: UpdateAccountInput) {
    updateMutation.mutate({ id: account.id, input }, { onSuccess: () => track("account_updated", { field, kind }) });
  }

  function commitName() {
    const next = name.trim();
    if (next === "" || next === account.name) return setName(account.name);
    save("name", { name: next });
  }

  function commitType(value: string) {
    const next = value.trim();
    if (next === "" || next === account.type) return;
    save("type", { type: next });
  }

  function commitBalance() {
    if (balanceValue === null || balanceValue === Number(account.balance)) return;
    save("balance", { balance: balanceValue });
  }

  function handleAppearanceChange(next: { color: AccountColor; icon: AccountIcon }) {
    setColor(next.color);
    setIcon(next.icon);
    save("appearance", { color: next.color, icon: next.icon });
  }

  function handleRemove() {
    deleteMutation.mutate(account.id, { onSuccess: () => track("account_removed", { kind }) });
    setConfirmOpen(false);
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <AccountIconColorPicker value={{ color, icon }} onChange={handleAppearanceChange}>
            <AccountAvatar color={color} icon={icon} className="size-12" size={22} />
            <span className="sr-only">{tr("Cambia icona e colore")}</span>
          </AccountIconColorPicker>
          <div className="min-w-0">
            <DialogTitle className="truncate">{account.name}</DialogTitle>
            <DialogDescription>
              {isAuto ? tr("Collegato alla banca") : tr("Conto manuale")} {"·"}{tr(status.label)}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="account-name" className={FIELD_LABEL}>{tr("Nome")}</label>
          <Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} onBlur={commitName} className={TALL_CONTROL} />
        </div>

        {isAuto ? (
          <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3 text-sm">
            <div>
              <dt className="text-text-2">{tr("Tipo")}</dt>
              <dd className="font-medium text-foreground">{account.type}</dd>
            </div>
            <div>
              <dt className="text-text-2">{tr("Saldo dalla banca")}</dt>
              <dd className="font-heading font-semibold tabular-nums text-foreground">{formatCurrency(Number(account.balance), currency)}</dd>
            </div>
          </dl>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="account-type" className={FIELD_LABEL}>{tr("Tipo")}</label>
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
                  commitType(value);
                }}
              >
                <SelectTrigger id="account-type" className={cn("w-full", TALL_CONTROL)}>
                  <SelectValue placeholder={tr("Tipo")}>{isCustomType ? tr("Altro…") : type}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_TYPE_VALUE}>{tr("Altro…")}</SelectItem>
                </SelectContent>
              </Select>
              {isCustomType && (
                <Input
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  onBlur={() => commitType(type)}
                  placeholder={tr("Es. Wallet crypto")}
                  aria-label={tr("Tipo personalizzato")}
                  className={TALL_CONTROL}
                />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="account-balance" className={FIELD_LABEL}>{tr("Saldo")}</label>
              <CurrencyInput
                id="account-balance"
                value={balanceValue}
                onChange={setBalanceValue}
                onBlur={commitBalance}
                currency={currency}
                className={cn("w-full text-right font-semibold", TALL_CONTROL)}
              />
              <p className="text-sm text-text-2">{tr("Lo aggiorni tu: si salva quando esci dal campo.")}</p>
            </div>
          </>
        )}

        {isAuto && (
          <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3">
            {syncResult ? (
              <SyncResultLine result={syncResult} locale={formattingLocale} />
            ) : null}
            {syncing ? null : (
              <p className="text-sm text-text-2" aria-live="polite">
                {describeSyncAvailability({ needsReconnect, syncing, syncInfo })}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className={cn("flex-1 cursor-pointer gap-1.5", TALL_CONTROL)}
                onClick={() => syncMutation.mutate(account.id)}
                disabled={syncDisabled}
              >
                <RefreshCw size={16} aria-hidden className={syncMutation.isPending || syncing ? "motion-safe:animate-spin" : undefined} />{tr("Sincronizza ora")}</Button>
              {needsReconnect && (
                <Button type="button" className={cn("flex-1 cursor-pointer gap-1.5", TALL_CONTROL)} onClick={syncInfo?.provider === "trade-republic" ? () => { window.location.href = "/conti/trade-republic"; } : onReconnect}>{tr("Riconnetti la banca")}</Button>
              )}
            </div>
          </div>
        )}

        {movementsHref && (
          <Link href={movementsHref} className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer gap-1.5", TALL_CONTROL)}>
            <ListOrdered size={16} aria-hidden />{tr("Vedi i movimenti di questo conto")}</Link>
        )}

        <Button
          type="button"
          variant="ghost"
          className={cn("cursor-pointer gap-1.5 text-destructive hover:text-destructive", TALL_CONTROL)}
          onClick={() => setConfirmOpen(true)}
        >
          {isAuto ? <Link2Off size={16} aria-hidden /> : <Trash2 size={16} aria-hidden />}
          {isAuto ? tr("Scollega il conto") : tr("Elimina il conto")}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isAuto ? tr("Scollegare questo conto?") : tr("Eliminare questo conto?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {isAuto
                ? tr("\"{0}\" verrà scollegato. L'azione non è reversibile.", {0: account.name})
                : tr("\"{0}\" verrà eliminato definitivamente, insieme al suo saldo registrato.", {0: account.name})}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr("Annulla")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>{isAuto ? tr("Scollega") : tr("Elimina")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function AccountDetailsDialog({ account, onClose, ...rest }: AccountDetailsDialogProps) {
  return (
    <Dialog open={account !== null} onOpenChange={(open) => !open && onClose()}>
      <FormDialogContent>
        {account && <AccountDetailsBody key={account.id} account={account} onClose={onClose} {...rest} />}
      </FormDialogContent>
    </Dialog>
  );
}

/** Progress while a sync runs, then its outcome, in the account window (the global panel may sit behind it). */
function SyncResultLine({ result, locale }: { result: { account: SyncJobAccount; interrupted: boolean }; locale: string }) {
  const { text, tone } = describeAccountProgress(result.account, result.interrupted, locale);
  return (
    <p className={cn("text-sm font-medium", tone === "error" ? "text-neg" : tone === "success" ? "text-pos" : "text-text-2")} role="status" aria-live="polite">
      {text}
    </p>
  );
}
