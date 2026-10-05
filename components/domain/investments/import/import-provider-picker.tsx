"use client";

/**
 * Scelta del provider nel primo passo dell'import: elenco compatto a righe, raggruppato e con ricerca quando i provider
 * sono molti; una volta scelto si riduce a una riga con «Cambia». Nessuna scelta = formato riconosciuto dal file.
 */

import * as React from "react";
import { ChevronRightIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  filterImportProviders,
  groupImportProviders,
  IMPORT_PROVIDERS,
  type ImportProviderId,
  type ImportProviderInfo,
} from "@/lib/investments/import/providers";
import { cn } from "@/lib/utils";
import { ProviderBadge } from "./provider-badge";

/** Da quanti provider in su compare la ricerca (sotto, l'elenco si legge tutto d'un colpo). */
export const PROVIDER_SEARCH_THRESHOLD = 6;

export interface ImportProviderPickerProps {
  value: ImportProviderId | null;
  onChange: (value: ImportProviderId | null) => void;
  /** Provider selezionabili; default: tutti quelli di `IMPORT_PROVIDERS`. */
  providers?: ImportProviderInfo[];
  /** Chiamata quando la ricerca produce un risultato scelto (per misurare quanto serve). */
  onSearchedChoice?: (value: ImportProviderId) => void;
}

function ProviderRow({
  provider,
  onClick,
  trailing,
}: {
  provider: ImportProviderInfo;
  onClick?: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <ProviderBadge provider={provider} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium text-foreground">{provider.name}</span>
        <span className="truncate text-xs text-muted-foreground">{provider.tagline}</span>
      </span>
      {trailing}
    </button>
  );
}

export function ImportProviderPicker({
  value,
  onChange,
  providers = IMPORT_PROVIDERS,
  onSearchedChoice,
}: ImportProviderPickerProps) {
  const [query, setQuery] = React.useState("");
  const selected = providers.find((p) => p.id === value) ?? null;

  if (selected) {
    return (
      <div role="group" aria-label="Provider scelto" className="flex items-center gap-2 rounded-xl border border-primary bg-primary/5 p-3">
        <ProviderBadge provider={selected} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-medium text-foreground">{selected.name}</span>
          <span className="truncate text-xs text-muted-foreground">{selected.tagline}</span>
        </span>
        <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
          Cambia
        </Button>
      </div>
    );
  }

  const searchable = providers.length >= PROVIDER_SEARCH_THRESHOLD;
  const visible = filterImportProviders(providers, query);
  const groups = groupImportProviders(visible);
  const choose = (id: ImportProviderId) => {
    if (query.trim()) onSearchedChoice?.(id);
    setQuery("");
    onChange(id);
  };

  return (
    <div role="group" aria-label="Da dove arriva il file" className="flex flex-col gap-3">
      {searchable ? (
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca un broker o un'app"
            aria-label="Cerca un provider"
            className="pl-9"
          />
        </div>
      ) : null}
      {groups.length === 0 ? (
        <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          Nessun provider con questo nome. Prova «Altro CSV»: indichi tu le colonne.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.id} className="flex flex-col gap-1.5" aria-label={group.label}>
            {searchable ? (
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.label}</h3>
            ) : null}
            <div className={cn("grid gap-1.5", providers.length >= PROVIDER_SEARCH_THRESHOLD && "sm:grid-cols-2")}>
              {group.providers.map((provider) => (
                <ProviderRow
                  key={provider.id}
                  provider={provider}
                  onClick={() => choose(provider.id)}
                  trailing={<ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
