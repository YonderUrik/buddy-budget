"use client";

/**
 * AccountRow
 *
 * Riga singola nella lista Conti. Nome, icona e colore sono editabili inline
 * (salvataggio on-blur/on-change) per qualsiasi conto, anche quelli "auto".
 * Tipo e saldo restano editabili solo per i conti manuali: per un conto auto
 * derivano dalla banca collegata, quindi sono in sola lettura + azione
 * "Scollega" con conferma al posto di "Elimina".
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
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Trash2, Link2Off, RefreshCw } from "lucide-react";
import { formatCurrency, formatRelativeTime } from "@/lib/format";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/validation/accounts";
import { useDeleteAccountMutation, useUpdateAccountMutation } from "@/lib/queries/accounts";
import { useSyncAccountMutation } from "@/lib/queries/gocardless";
import type { UpdateAccountInput } from "@/lib/validation/accounts";
import type { AccountColor, AccountIcon } from "@/lib/validation/accounts";
import type { Account } from "@/lib/db/schema/accounts";
import { AccountAvatar } from "./account-avatar";
import { AccountIconColorPicker } from "./account-icon-color-picker";
import { CurrencyInput } from "./currency-input";

const CUSTOM_TYPE_VALUE = "__custom__";

/** Testo del `title` nativo del bottone sync, spiega perché è disabilitato quando non eleggibile. */
function buildSyncButtonTitle(
  syncInfo: AccountRowProps["syncInfo"],
  needsReconnect?: boolean
): string {
  if (needsReconnect) return "Riconnetti il conto per sincronizzare";
  if (!syncInfo) return "Info di sincronizzazione non disponibili";
  if (syncInfo.eligible) return "Sincronizza ora";
  if (!syncInfo.nextEligibleAt) return "Sync non disponibile";
  const time = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(syncInfo.nextEligibleAt)
  );
  return syncInfo.syncsRemainingToday === 0
    ? `Limite di 4 sync al giorno raggiunto. Prossimo alle ${time}.`
    : `Prossimo sync disponibile alle ${time}.`;
}

export interface AccountRowProps {
  account: Account;
  /** Valuta dell'utente (ISO 4217), usata per formattare il saldo. */
  currency: string;
  /** True se il consenso bancario collegato a questo conto è scaduto/in errore. */
  needsReconnect?: boolean;
  /** Chiamato quando l'utente clicca "Riconnetti". */
  onReconnect?: () => void;
  /** Info di sync (solo per conti auto): ultimo sync ed eleggibilità al prossimo sync manuale. */
  syncInfo?: {
    lastSyncedAt: string | null;
    eligible: boolean;
    nextEligibleAt: string | null;
    syncsRemainingToday: number;
  };
}

export function AccountRow({ account, currency, needsReconnect, onReconnect, syncInfo }: AccountRowProps) {
  const isAuto = account.source === "auto";
  const updateMutation = useUpdateAccountMutation();
  const deleteMutation = useDeleteAccountMutation();
  const syncMutation = useSyncAccountMutation();

  const [name, setName] = React.useState(account.name);
  const [type, setType] = React.useState(account.type);
  const [balanceValue, setBalanceValue] = React.useState<number | null>(Number(account.balance));
  const [color, setColor] = React.useState<AccountColor>(account.color as AccountColor);
  const [icon, setIcon] = React.useState<AccountIcon>(account.icon as AccountIcon);
  const [confirmDialogOpen, setConfirmDialogOpen] = React.useState(false);
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
    setConfirmDialogOpen(false);
  }

  const avatar = <AccountAvatar color={color} icon={icon} />;

  return (
    <div className="group relative flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/10 transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <AccountIconColorPicker value={{ color, icon }} onChange={handleAppearanceChange}>
          {avatar}
        </AccountIconColorPicker>

        <div className="min-w-0 flex-1 space-y-1">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => commitField("name", name)}
            className="h-7 w-full border-0 bg-transparent p-0 font-medium shadow-none focus-visible:ring-1 focus-visible:ring-ring focus:bg-background px-1.5 -mx-1.5 text-sm"
            aria-label="Nome conto"
          />

          <div className="flex items-center gap-2">
            {isAuto ? (
              <span className="text-xs text-muted-foreground pl-0.5">{account.type}</span>
            ) : (
              <div className="flex items-center gap-1.5">
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
                  <SelectTrigger size="sm" className="h-6 border-0 bg-transparent p-0 pr-1 pl-0.5 shadow-none focus-visible:ring-1 focus-visible:ring-ring text-xs text-muted-foreground font-normal hover:bg-accent/40 w-fit">
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
                    className="h-6 w-28 border-0 bg-transparent p-0 px-1.5 -mx-1.5 shadow-none focus-visible:ring-1 focus-visible:ring-ring focus:bg-background text-xs text-muted-foreground"
                    aria-label="Tipo personalizzato"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="flex flex-col items-end gap-1">
          {isAuto ? (
            <p className="h-7 text-right text-sm font-semibold tabular-nums flex items-center pr-1.5 text-foreground">
              {formatCurrency(Number(account.balance), currency)}
            </p>
          ) : (
            <CurrencyInput
              value={balanceValue}
              onChange={setBalanceValue}
              onBlur={() => commitField("balance", balanceValue)}
              currency={currency}
              className="w-24 text-right text-sm font-semibold sm:w-28 border-0 bg-transparent p-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring focus:bg-background pr-1.5"
              aria-label="Saldo"
            />
          )}

          <div className="flex items-center gap-2">
            {isAuto && syncInfo && (
              <span className="text-[10px] text-muted-foreground">
                {syncInfo.lastSyncedAt
                  ? `Ultimo sync: ${formatRelativeTime(new Date(syncInfo.lastSyncedAt))}`
                  : "Mai sincronizzato"}
              </span>
            )}
            {needsReconnect && (
              <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive uppercase">
                Riconnetti
              </span>
            )}
            <Badge variant={isAuto ? "secondary" : "outline"} className="text-[10px] py-0 px-1.5 h-4 font-normal">
              {isAuto ? "Auto" : "Manuale"}
            </Badge>
          </div>
        </div>

        {isAuto && (
          <button
            type="button"
            onClick={() => syncMutation.mutate(account.id)}
            disabled={!syncInfo?.eligible || syncMutation.isPending || needsReconnect}
            title={buildSyncButtonTitle(syncInfo, needsReconnect)}
            aria-label="Sincronizza ora"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw size={15} className={syncMutation.isPending ? "animate-spin" : undefined} />
          </button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer">
            <MoreVertical size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent align="end" className="w-36">
              {needsReconnect && (
                <DropdownMenuItem onClick={onReconnect}>
                  <RefreshCw size={14} className="mr-2" />
                  Riconnetti
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmDialogOpen(true)}
              >
                {isAuto ? (
                  <>
                    <Link2Off size={14} className="mr-2" />
                    Scollega
                  </>
                ) : (
                  <>
                    <Trash2 size={14} className="mr-2" />
                    Elimina
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenu>

        <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
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
    </div>
  );
}
