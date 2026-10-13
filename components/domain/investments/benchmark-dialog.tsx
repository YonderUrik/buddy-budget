"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Dialog per scegliere (o togliere) lo strumento con cui confrontare il rendimento del portafoglio. */

import { FormDialogContent } from "@/components/domain/shared";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {Dialog} from "@/components/ui/dialog";
import type { Instrument } from "@/lib/db/schema/investments";
import { BENCHMARK_SUGGESTIONS } from "@/lib/investments/benchmark-suggestions";
import { useCreateInstrumentMutation, useUpdatePortfolioMutation } from "@/lib/queries/investments";
import { InstrumentPicker } from "./instrument-picker";
import { GitCompareArrowsIcon } from "lucide-react";
import { PanelDialogHeader } from "./dialog-parts";

export interface BenchmarkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: Instrument | null;
  currency: string;
}

export function BenchmarkDialog({ open, onOpenChange, current, currency }: BenchmarkDialogProps) {
  const { t: tr } = useLocalization();
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
      <FormDialogContent>
        <PanelDialogHeader icon={GitCompareArrowsIcon} title={tr("Confronta con un indice")} description={tr("Confrontiamo gli stessi versamenti, negli stessi giorni, con un ETF ad accumulazione.")} color="var(--swatch-indigo)" />
        <section aria-label={tr("Benchmark comuni")} className="space-y-2">
          <p className="text-sm font-medium">{tr("Benchmark comuni")}</p>
          <p className="text-xs text-muted-foreground">{tr("Scegli un indice: il confronto usa l’ETF ad accumulazione indicato.")}</p>
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
                  <span>{tr(suggestion.label)}{selected ? tr(" · Attuale") : ""}</span>
                  <span className="text-xs font-normal text-muted-foreground">{tr(suggestion.description)}</span>
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
          placeholder={tr("Oppure cerca un altro strumento")}
        />
        {pending ? <p role="status" className="text-sm text-muted-foreground">{tr("Salvo e scarico i prezzi…")}</p> : null}
        {create.isError || update.isError ? <p role="alert" className="text-sm text-destructive">{create.error?.message ?? update.error?.message}</p> : null}
        {current ? (
          <Button variant="ghost" className="self-start text-muted-foreground" disabled={pending} onClick={() => { create.reset(); save(null); }}>{tr("Togli il confronto")}</Button>
        ) : null}
      </FormDialogContent>
    </Dialog>
  );
}
