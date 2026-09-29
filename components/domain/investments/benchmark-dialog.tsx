"use client";

/** Dialog per scegliere (o togliere) lo strumento con cui confrontare il rendimento del portafoglio. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Instrument } from "@/lib/db/schema/investments";
import { useUpdatePortfolioMutation } from "@/lib/queries/investments";
import { InstrumentPicker } from "./instrument-picker";

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
        <DialogHeader>
          <DialogTitle>Confronta con un indice</DialogTitle>
          <DialogDescription>
            Mettiamo gli stessi soldi, negli stessi giorni, in un altro strumento e vediamo quanto avresti oggi. Di solito si
            sceglie un ETF azionario globale ad accumulazione (i dividendi sono già nel prezzo).
          </DialogDescription>
        </DialogHeader>
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
