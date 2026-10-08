"use client";

/** Dialog per inserire a mano il prezzo di uno strumento in una data: vale solo per il tuo portafoglio. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import {Dialog, DialogContent} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Instrument } from "@/lib/db/schema/investments";
import { useSaveManualPriceMutation } from "@/lib/queries/investments";
import { parseAmount } from "@/lib/validation/accounts";
import { localTodayKey, priceLabel } from "./register-operation-form.state";
import { PencilLineIcon } from "lucide-react";
import { PanelDialogHeader } from "./dialog-parts";
import { DialogActions } from "./dialog-parts";

export interface ManualPriceDialogProps {
  instrument: Instrument | null;
  onClose: () => void;
}

export function ManualPriceDialog({ instrument, onClose }: ManualPriceDialogProps) {
  const save = useSaveManualPriceMutation();
  const [date, setDate] = React.useState(localTodayKey());
  const [close, setClose] = React.useState("");
  const value = parseAmount(close);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!instrument || !value || value <= 0) return;
    save.mutate(
      { instrumentId: instrument.id, input: { date, close: value } },
      {
        onSuccess: () => {
          setClose("");
          onClose();
        },
      }
    );
  }

  return (
    <Dialog open={instrument !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <PanelDialogHeader icon={PencilLineIcon} title={<>Prezzo di {instrument?.name}</>} color="var(--swatch-amber)" />
        <form onSubmit={submit} className="flex flex-col gap-5">
          <p className="text-sm text-muted-foreground">
            Vale solo per il tuo portafoglio e ha la precedenza sui prezzi automatici dello stesso giorno.
          </p>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Data
            <Input type="date" value={date} max={localTodayKey()} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {priceLabel(instrument?.priceUnit)} ({instrument?.currency})
            <Input inputMode="decimal" value={close} onChange={(e) => setClose(e.target.value)} />
          </label>
          {save.isError ? <p className="text-sm text-destructive">{save.error.message}</p> : null}
          <DialogActions>
            <span />
            <Button type="submit" disabled={!value || value <= 0 || save.isPending}>
              Salva prezzo
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
