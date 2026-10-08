"use client";

/** Dialog per scegliere (o togliere) lo strumento con cui confrontare il rendimento del portafoglio. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Instrument } from "@/lib/db/schema/investments";
import { BENCHMARK_SUGGESTIONS } from "@/lib/investments/benchmark-suggestions";
import { useCreateInstrumentMutation, useUpdatePortfolioMutation } from "@/lib/queries/investments";
import { InstrumentPicker } from "./instrument-picker";

export interface BenchmarkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: Instrument | null;
  currency: string;
}

export function BenchmarkDialog({ open, onOpenChange, current, currency }: BenchmarkDialogProps) {
  const update = useUpdatePortfolioMutation();
  const create = useCreateInstrumentMutation({ deferHistory: true });
  const pending = create.isPending || update.isPending;

  function save(benchmarkInstrumentId: string | null) {
    update.mutate({ benchmarkInstrumentId }, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) {
          update.reset();
          create.reset();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confronta con un indice</DialogTitle>
          <DialogDescription>
            Mettiamo gli stessi soldi, negli stessi giorni, in un altro strumento e vediamo quanto avresti oggi. Di solito si
            sceglie un ETF ad accumulazione (i dividendi sono già nel prezzo).
          </DialogDescription>
        </DialogHeader>
        <section aria-label="Benchmark comuni" className="space-y-2">
          <p className="text-sm font-medium">Benchmark comuni</p>
          <p className="text-xs text-muted-foreground">Scegli un indice: il confronto usa l’ETF ad accumulazione indicato.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {BENCHMARK_SUGGESTIONS.map((suggestion) => {
              const selected = current?.isin === suggestion.isin;
              return (
                <Button
                  key={suggestion.yahooSymbol}
                  variant={selected ? "secondary" : "outline"}
                  className="h-auto min-w-0 flex-col items-start gap-1 whitespace-normal p-3 text-left"
                  disabled={pending}
                  aria-pressed={selected}
                  onClick={() => {
                    update.reset();
                    create.mutate(
                      { source: "yahoo", type: "etf", name: suggestion.name, yahooSymbol: suggestion.yahooSymbol, isin: suggestion.isin },
                      { onSuccess: (instrument) => save(instrument.id) }
                    );
                  }}
                >
                  <span>{suggestion.label}{selected ? " · Attuale" : ""}</span>
                  <span className="text-xs font-normal text-muted-foreground">{suggestion.description}</span>
                  <span className="text-xs font-normal text-muted-foreground">{suggestion.name} · {suggestion.yahooSymbol}</span>
                </Button>
              );
            })}
          </div>
        </section>
        <InstrumentPicker
          value={current}
          onChange={(instrument) => { create.reset(); save(instrument.id); }}
          defaultCurrency={currency}
          disabled={pending}
          deferHistory
          placeholder="Oppure cerca un altro strumento"
        />
        {pending ? <p role="status" className="text-sm text-muted-foreground">Salvo e scarico i prezzi…</p> : null}
        {create.isError || update.isError ? <p role="alert" className="text-sm text-destructive">{create.error?.message ?? update.error?.message}</p> : null}
        {current ? (
          <Button variant="ghost" className="self-start text-muted-foreground" disabled={pending} onClick={() => { create.reset(); save(null); }}>
            Togli il confronto
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
