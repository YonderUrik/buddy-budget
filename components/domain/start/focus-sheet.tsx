"use client";
import { useLocalization } from "@/lib/localization/provider";

/** «Cambia cosa vuoi tenere sotto controllo»: the onboarding question again, in a dialog (a bottom sheet on the phone). */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { StartFocus, StartFocusOption } from "@/lib/start";
import { FocusPicker } from "./focus-picker";

export interface FocusSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current answer, preselected when the sheet opens. */
  initial: readonly StartFocus[];
  options: readonly StartFocusOption[];
  onSave: (focus: StartFocus[]) => void;
  pending?: boolean;
  errorMessage?: string | null;
}

export function FocusSheet({ open, onOpenChange, initial, options, onSave, pending, errorMessage }: FocusSheetProps) {
  const { t: tr } = useLocalization();
  const [value, setValue] = React.useState<StartFocus[]>([...initial]);
  // Every opening starts from the saved answer, not from a choice left unsaved last time.
  const [lastOpen, setLastOpen] = React.useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setValue([...initial]);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tr("Cosa vuoi tenere sotto controllo?")}</DialogTitle>
          <DialogDescription>{tr("I primi passi cambiano con la tua scelta. Senza nessuna scelta restano i quattro di partenza.")}</DialogDescription>
        </DialogHeader>
        <FocusPicker value={value} onChange={setValue} options={options} disabled={pending} className="sm:grid-cols-1" />
        {errorMessage ? (
          <p className="text-sm text-neg" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" className="h-11 px-4" onClick={() => onOpenChange(false)}>
            {tr("Annulla")}
          </Button>
          <Button className="h-11 px-5" onClick={() => onSave(value)} disabled={pending}>
            {pending ? tr("Salvataggio in corso…") : tr("Salva")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
