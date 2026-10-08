"use client";

/** Dialog per scegliere (o togliere) lo strumento con cui confrontare il rendimento del portafoglio. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import {Dialog, DialogContent} from "@/components/ui/dialog";
import type { Instrument } from "@/lib/db/schema/investments";
import { useUpdatePortfolioMutation } from "@/lib/queries/investments";
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
  const update = useUpdatePortfolioMutation();

  function save(benchmarkInstrumentId: string | null) {
    update.mutate({ benchmarkInstrumentId }, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) update.reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <PanelDialogHeader icon={GitCompareArrowsIcon} title="Confronta con un indice" description="Mettiamo gli stessi soldi, negli stessi giorni, in un altro strumento e vediamo quanto avresti oggi. Di solito si sceglie un ETF azionario globale ad accumulazione (i dividendi sono già nel prezzo)." color="var(--swatch-indigo)" />
        <InstrumentPicker value={current} onChange={(instrument) => save(instrument.id)} defaultCurrency={currency} />
        {update.isPending ? <p className="text-sm text-muted-foreground">Salvo e scarico i prezzi…</p> : null}
        {update.isError ? <p className="text-sm text-destructive">{update.error.message}</p> : null}
        {current ? (
          <Button variant="ghost" className="self-start text-muted-foreground" disabled={update.isPending} onClick={() => save(null)}>
            Togli il confronto
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
