"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Dialog to choose (or remove) what the portfolio is compared with: the four common indices as rows with their logo,
 * what they hold and the ETF used, or any other instrument from the search below.
 */

import { FormDialogContent } from "@/components/domain/shared";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {Dialog} from "@/components/ui/dialog";
import type { Instrument } from "@/lib/db/schema/investments";
import { BENCHMARK_SUGGESTIONS, matchBenchmarkSuggestion } from "@/lib/investments/benchmark-suggestions";
import { BenchmarkOption } from "./benchmark-option";
import { track } from "@/lib/analytics";
import type { BenchmarkSuggestion } from "@/lib/investments/benchmark-suggestions";
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
  const currentSuggestion = matchBenchmarkSuggestion(current);

  /** `choice`: which common index, `other` for one from the search, `none` when the comparison is removed. */
  function save(benchmarkInstrumentId: string | null, choice: BenchmarkSuggestion["id"] | "other" | "none") {
    update.mutate({ benchmarkInstrumentId }, {
      onSuccess: () => {
        track("investment_benchmark_chosen", { choice });
        onOpenChange(false);
      },
    });
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
        <PanelDialogHeader icon={GitCompareArrowsIcon} title={tr("Confronta con un indice")} description={tr("Mettiamo i tuoi stessi versamenti, negli stessi giorni, in un ETF che replica l’indice.")} color="var(--swatch-indigo)" />
        <section aria-label={tr("Indici più usati")} className="flex flex-col gap-2">
          <p className="text-sm font-medium">{tr("Indici più usati")}</p>
          <div className="flex flex-col gap-2">
            {BENCHMARK_SUGGESTIONS.map((suggestion) => (
              <BenchmarkOption
                key={suggestion.id}
                suggestion={suggestion}
                selected={currentSuggestion?.id === suggestion.id}
                disabled={pending}
                onSelect={() => {
                  if (currentSuggestion?.id === suggestion.id) return onOpenChange(false);
                  update.reset();
                  create.mutate(
                    { source: "yahoo", type: "etf", name: suggestion.name, yahooSymbol: suggestion.yahooSymbol, isin: suggestion.isin },
                    { onSuccess: (instrument) => save(instrument.id, suggestion.id) }
                  );
                }}
              />
            ))}
          </div>
        </section>
        <InstrumentPicker
          value={currentSuggestion ? null : current}
          onChange={(instrument) => { create.reset(); save(instrument.id, matchBenchmarkSuggestion(instrument)?.id ?? "other"); }}
          defaultCurrency={currency}
          disabled={pending}
          deferHistory
          placeholder={tr("Oppure cerca un altro ETF o titolo")}
        />
        {pending ? <p role="status" className="text-sm text-muted-foreground">{tr("Salvo e scarico i prezzi…")}</p> : null}
        {create.isError || update.isError ? <p role="alert" className="text-sm text-destructive">{create.error?.message ?? update.error?.message}</p> : null}
        {current ? (
          <Button variant="ghost" className="self-start text-muted-foreground" disabled={pending} onClick={() => { create.reset(); save(null, "none"); }}>{tr("Togli il confronto")}</Button>
        ) : null}
      </FormDialogContent>
    </Dialog>
  );
}
