"use client";

/**
 * Selettore strumento con ricerca per nome, ticker o ISIN: prima gli strumenti già noti, poi i risultati delle fonti
 * di mercato e delle crypto (sceglierne uno lo aggiunge), infine "Non lo trovi?" per BTP o strumenti manuali.
 */

import * as React from "react";
import { ChevronDownIcon, SearchIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Instrument } from "@/lib/db/schema/investments";
import { INSTRUMENT_TYPE_SINGULAR } from "@/lib/investments/labels";
import { useCreateInstrumentMutation, useInstrumentSearchQuery } from "@/lib/queries/investments";
import type { CreateInstrumentInput } from "@/lib/validation/investments";
import { cn } from "@/lib/utils";
import { InstrumentManualForm } from "./instrument-manual-form";

export interface InstrumentPickerProps {
  value: Instrument | null;
  onChange: (instrument: Instrument) => void;
  /** Valuta proposta per crypto e strumenti manuali. */
  defaultCurrency: string;
  className?: string;
}

function ResultButton({ title, detail, onClick, disabled }: { title: string; detail: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:opacity-50"
    >
      <span className="w-full truncate text-sm text-foreground">{title}</span>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="px-2 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

export function InstrumentPicker({ value, onChange, defaultCurrency, className }: InstrumentPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const search = useInstrumentSearchQuery(query);
  const create = useCreateInstrumentMutation();
  const knownIds = new Set(search.data?.known.map((k) => k.id));
  const market = search.data?.market ?? [];
  const crypto = search.data?.crypto ?? [];

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
          {search.data?.known.length ? (
            <Section title="Già aggiunti">
              {search.data.known.map((i) => (
                <ResultButton key={i.id} title={i.name} detail={`${INSTRUMENT_TYPE_SINGULAR[i.type]} · ${i.currency}${i.isin ? ` · ${i.isin}` : ""}`} onClick={() => choose(i)} />
              ))}
            </Section>
          ) : null}
          {market.length ? (
            <Section title="Mercato">
              {market.map((hit) => (
                <ResultButton
                  key={hit.symbol}
                  title={hit.name}
                  detail={`${hit.symbol} · ${hit.exchangeLabel} · ${INSTRUMENT_TYPE_SINGULAR[hit.type]}`}
                  disabled={create.isPending}
                  onClick={() => add({ source: "yahoo", yahooSymbol: hit.symbol, name: hit.name, type: hit.type, ...(search.data?.isin ? { isin: search.data.isin } : {}) })}
                />
              ))}
            </Section>
          ) : null}
          {crypto.length ? (
            <Section title="Crypto">
              {crypto.map((c) => (
                <ResultButton
                  key={c.id}
                  title={c.name}
                  detail={`${c.symbol} · in ${defaultCurrency}`}
                  disabled={create.isPending}
                  onClick={() => add({ source: "coingecko", coingeckoId: c.id, name: c.name, currency: defaultCurrency })}
                />
              ))}
            </Section>
          ) : null}
          {searching && search.data && !knownIds.size && !market.length && !crypto.length ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">Nessun risultato dalle fonti di mercato.</p>
          ) : null}
          {searching ? (
            <Section title="Non lo trovi?">
              <div className="px-2 pb-1">
                <InstrumentManualForm isin={search.data?.isin ?? null} defaultCurrency={defaultCurrency} pending={create.isPending} onCreate={add} />
              </div>
            </Section>
          ) : null}
          {create.isError ? <p className="px-2 py-2 text-sm text-destructive">{create.error.message}</p> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
