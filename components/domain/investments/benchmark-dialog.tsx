"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Dialog per scegliere (o togliere) lo strumento con cui confrontare il rendimento del portafoglio. */

import { FormDialogContent } from "@/components/domain/shared";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {Dialog} from "@/components/ui/dialog";
import type { Instrument } from "@/lib/db/schema/investments";
import { BENCHMARK_SUGGESTIONS, matchBenchmarkSuggestion } from "@/lib/investments/benchmark-suggestions";
import { useDesignProposal } from "@/lib/investments/design-proposal";
import { BenchmarkOption } from "./benchmark-option";
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
  const proposal = useDesignProposal();
  const currentSuggestion = matchBenchmarkSuggestion(current);

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
        <PanelDialogHeader icon={GitCompareArrowsIcon} title={tr("Confronta con un indice")} description={tr("Mettiamo i tuoi stessi versamenti, negli stessi giorni, in un ETF che replica l’indice.")} color="var(--swatch-indigo)" />
        <section aria-label={tr("Indici più usati")} className="flex flex-col gap-2">
          <p className="text-sm font-medium">{tr("Indici più usati")}</p>
          <div className={proposal === "b" ? "grid grid-cols-2 gap-2" : "flex flex-col gap-2"}>
            {BENCHMARK_SUGGESTIONS.map((suggestion) => (
              <BenchmarkOption
                key={suggestion.id}
                suggestion={suggestion}
                layout={proposal === "b" ? "tile" : "row"}
                selected={currentSuggestion?.id === suggestion.id}
                disabled={pending}
                onSelect={() => {
                  if (currentSuggestion?.id === suggestion.id) return onOpenChange(false);
                  update.reset();
                  create.mutate(
                    { source: "yahoo", type: "etf", name: suggestion.name, yahooSymbol: suggestion.yahooSymbol, isin: suggestion.isin },
                    { onSuccess: (instrument) => save(instrument.id) }
                  );
                }}
              />
            ))}
          </div>
        </section>
        <InstrumentPicker
          value={currentSuggestion ? null : current}
          onChange={(instrument) => { create.reset(); save(instrument.id); }}
          defaultCurrency={currency}
          disabled={pending}
          deferHistory
          placeholder={tr("Oppure cerca un altro ETF o titolo")}
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
