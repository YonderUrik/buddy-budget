"use client";

/** Promemoria "Solo questo conto" con un tasto per toglierlo; non compare se nessun conto è filtrato. */

import { X } from "lucide-react";
import { useAccountsQuery } from "@/lib/queries/accounts";

export interface AccountFilterChipProps {
  accountId: string | null;
  onClear: () => void;
}

export function AccountFilterChip({ accountId, onClear }: AccountFilterChipProps) {
  const { data: accounts } = useAccountsQuery();
  if (!accountId) return null;
  const name = accounts?.find((account) => account.id === accountId)?.name ?? "conto selezionato";
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>Solo movimenti di</span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Togli il filtro sul conto ${name}`}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-muted px-3 font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {name}
        <X size={13} aria-hidden="true" />
      </button>
    </div>
  );
}
