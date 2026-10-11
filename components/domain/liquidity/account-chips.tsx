"use client";

/** Riga scorrevole di conti usati come filtro: "Tutti" più un chip per conto con il saldo; il filtro vale per grafico ed elenco. */

import { AlertTriangleIcon, PlusIcon } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface AccountChip {
  id: string;
  name: string;
  balance: number;
  /** Mostra un segnale d'avviso (collegamento in scadenza o interrotto). */
  needsAttention?: boolean;
}

export interface AccountChipsProps {
  accounts: readonly AccountChip[];
  total: number;
  currency: string;
  /** Conto selezionato; null = tutti. */
  selectedId: string | null;
  onSelect: (accountId: string | null) => void;
  onAdd?: () => void;
  className?: string;
}

const CHIP_BASE =
  "flex min-h-14 shrink-0 flex-col justify-center rounded-2xl border-[1.5px] px-4 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function AccountChips({ accounts, total, currency, selectedId, onSelect, onAdd, className }: AccountChipsProps) {
  const chip = (id: string | null, name: string, amount: number, attention = false) => {
    const active = selectedId === id;
    return (
      <button
        key={id ?? "tutti"}
        type="button"
        onClick={() => onSelect(id)}
        aria-pressed={active}
        className={cn(CHIP_BASE, active ? "border-primary bg-primary/10" : "border-transparent bg-foreground/[0.04] hover:bg-foreground/[0.07]")}
      >
        <span className="font-heading text-base font-medium tabular-nums">{formatCurrency(amount, currency, { maximumFractionDigits: 0 })}</span>
        <span className="flex items-center gap-1 text-sm text-text-2">
          {name}
          {attention && (
            <>
              <AlertTriangleIcon className="size-3.5 text-neg" aria-hidden="true" />
              <span className="sr-only">: serve un intervento</span>
            </>
          )}
        </span>
      </button>
    );
  };
  return (
    <div role="group" aria-label="Filtra per conto" className={cn("scrollbar-hidden -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0", className)}>
      {chip(null, "Tutti i conti", total)}
      {accounts.map((account) => chip(account.id, account.name, account.balance, account.needsAttention))}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className={cn(CHIP_BASE, "flex-row items-center gap-1.5 border-dashed border-border font-semibold text-primary hover:bg-foreground/[0.04]")}
        >
          <PlusIcon className="size-4" aria-hidden="true" />
          Conto
        </button>
      )}
    </div>
  );
}
