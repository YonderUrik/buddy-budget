"use client";

/**
 * Elenco dei provider del primo passo dell'import: una riga per broker (logo, nome, cosa si carica); nessuna riga scelta
 * = il formato lo riconosce il file. La riga scelta si apre sul suo contenuto (`renderSelected`: come esportare il file).
 */

import * as React from "react";
import { CheckIcon } from "lucide-react";
import { IMPORT_PROVIDERS, type ImportProviderId, type ImportProviderInfo } from "@/lib/investments/import/providers";
import { cn } from "@/lib/utils";
import { ProviderBadge } from "./provider-badge";

export interface ImportProviderPickerProps {
  value: ImportProviderId | null;
  onChange: (value: ImportProviderId | null) => void;
  /** Contenuto mostrato sotto la riga scelta. */
  renderSelected?: (provider: ImportProviderInfo) => React.ReactNode;
}

export function ImportProviderPicker({ value, onChange, renderSelected }: ImportProviderPickerProps) {
  return (
    <div role="group" aria-label="Da dove arriva il file" className="flex flex-col divide-y">
      {IMPORT_PROVIDERS.map((provider) => {
        const selected = value === provider.id;
        return (
          <div key={provider.id} className="flex flex-col py-1 first:pt-0 last:pb-0">
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected ? null : provider.id)}
              className={cn(
                "flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                selected && "bg-primary/5",
              )}
            >
              <span className="flex w-24 shrink-0 justify-center">
                <ProviderBadge provider={provider} className="w-full max-w-24" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium text-foreground">{provider.name}</span>
                <span className="text-xs text-muted-foreground">{provider.tagline}</span>
              </span>
              <span
                className={cn("grid size-5 shrink-0 place-items-center rounded-full border", selected ? "border-primary bg-primary text-primary-foreground" : "border-border")}
                aria-hidden="true"
              >
                {selected ? <CheckIcon className="size-3" /> : null}
              </span>
            </button>
            {selected && renderSelected ? <div className="px-2 pb-2 pt-3 sm:pl-[7.75rem]">{renderSelected(provider)}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
