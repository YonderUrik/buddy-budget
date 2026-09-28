"use client";

/**
 * Selettore strumento con ricerca per nome, ticker o ISIN: prima gli strumenti già noti, poi i risultati di mercato
 * divisi per tipo (sceglierne uno lo aggiunge), infine "Non lo trovi?" per BTP o strumenti manuali.
 */

import * as React from "react";
import { ChevronDownIcon, SearchIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Instrument } from "@/lib/db/schema/investments";
import { groupSearchResults, type MarketSearchItem } from "@/lib/investments/search-results";
import { useCreateInstrumentMutation, useInstrumentSearchQuery } from "@/lib/queries/investments";
import type { CreateInstrumentInput } from "@/lib/validation/investments";
import { cn } from "@/lib/utils";
import { InstrumentManualForm } from "./instrument-manual-form";
import { InstrumentSearchResults } from "./instrument-search-results";

export interface InstrumentPickerProps {
  value: Instrument | null;
  onChange: (instrument: Instrument) => void;
  /** Valuta proposta per crypto e strumenti manuali. */
  defaultCurrency: string;
  className?: string;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="px-2 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</p>;
}

/** Input di creazione per un risultato di mercato; l'ISIN digitato si allega ai risultati Yahoo. */
function toCreateInput(item: MarketSearchItem, currency: string, isin: string | null): CreateInstrumentInput {
  if (item.source === "coingecko") return { source: "coingecko", coingeckoId: item.coin.id, name: item.coin.name, currency };
  const { hit } = item;
  return { source: "yahoo", yahooSymbol: hit.symbol, name: hit.name, type: hit.type, ...(isin ? { isin } : {}) };
}

export function InstrumentPicker({ value, onChange, defaultCurrency, className }: InstrumentPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const search = useInstrumentSearchQuery(query);
  const create = useCreateInstrumentMutation();
  const known = search.data?.known ?? [];
  const groups = groupSearchResults(search.data?.market ?? [], search.data?.crypto ?? [], query);

  function choose(instrument: Instrument) {
    onChange(instrument);
    setOpen(false);
    setQuery("");
    create.reset();
  }

  function add(input: CreateInstrumentInput) {
    create.mutate(input, { onSuccess: choose });
  }

  const searching = query.trim().length >= 2;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm",
          className
        )}
      >
        <span className={cn("truncate", !value && "text-muted-foreground")}>{value?.name ?? "Cerca per nome, ticker o ISIN"}</span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) min-w-72 p-2" align="start">
        <div className="flex items-center gap-2 rounded-md border border-input px-2">
          <SearchIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="VWCE, Apple, IE00BK5BQT80…"
            aria-label="Cerca strumento"
            className="h-9 w-full bg-transparent text-sm outline-none"
          />
        </div>
        <div className="mt-1 flex max-h-80 flex-col overflow-y-auto">
          {!searching ? <p className="px-2 py-3 text-sm text-muted-foreground">Scrivi almeno 2 caratteri.</p> : null}
          {searching && search.isFetching && !search.data ? <p className="px-2 py-3 text-sm text-muted-foreground">Ricerca…</p> : null}
          {search.data ? (
            <InstrumentSearchResults
              known={known}
              groups={groups}
              cryptoCurrency={defaultCurrency}
              disabled={create.isPending}
              onChoose={choose}
              onAdd={(item) => add(toCreateInput(item, defaultCurrency, search.data?.isin ?? null))}
            />
          ) : null}
          {searching && search.data?.marketUnavailable ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">
              La fonte di ETF, azioni e fondi non risponde in questo momento: riprova tra qualche minuto, oppure
              aggiungilo qui sotto.
            </p>
          ) : null}
          {searching && search.data && !search.data.marketUnavailable && !known.length && !groups.length ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">Nessun risultato dalle fonti di mercato.</p>
          ) : null}
          {searching ? (
            <div className="flex flex-col gap-0.5">
              <SectionTitle>Non lo trovi?</SectionTitle>
              <div className="px-2 pb-1">
                <InstrumentManualForm isin={search.data?.isin ?? null} defaultCurrency={defaultCurrency} pending={create.isPending} onCreate={add} />
              </div>
            </div>
          ) : null}
          {create.isError ? <p className="px-2 py-2 text-sm text-destructive">{create.error.message}</p> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
