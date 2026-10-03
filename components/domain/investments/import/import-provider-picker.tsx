"use client";

/** Griglia di schede provider del primo passo dell'import; nessuna scheda scelta = formato riconosciuto dal file. */

import { CheckIcon } from "lucide-react";
import { IMPORT_PROVIDERS, type ImportProviderId } from "@/lib/investments/import/providers";
import { cn } from "@/lib/utils";
import { ProviderBadge } from "./provider-badge";

export interface ImportProviderPickerProps {
  value: ImportProviderId | null;
  onChange: (value: ImportProviderId | null) => void;
}

export function ImportProviderPicker({ value, onChange }: ImportProviderPickerProps) {
  return (
    <div role="group" aria-label="Da dove arriva il file" className="grid gap-2 sm:grid-cols-3">
      {IMPORT_PROVIDERS.map((provider) => {
        const selected = value === provider.id;
        return (
          <button
            key={provider.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? null : provider.id)}
            className={cn(
              "relative flex items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex-col sm:items-start",
              selected && "border-primary bg-primary/5",
            )}
          >
            <ProviderBadge provider={provider} />
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-foreground">{provider.name}</span>
              <span className="text-xs text-muted-foreground">{provider.tagline}</span>
            </span>
            {selected ? <CheckIcon className="absolute right-3 top-3 size-4 text-primary" aria-hidden="true" /> : null}
          </button>
        );
      })}
    </div>
  );
}
