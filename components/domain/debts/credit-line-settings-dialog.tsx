"use client";

/** Impostazioni di una linea di credito: fido, spread e regole di addebito. Cambiano il calcolo anche del passato. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildCreditLineSettingsPatch, creditLineFormFromView, validateCreditLineForm, type CreditLineFormState } from "@/lib/debts/credit-line-form";
import type { CreditLineView } from "@/lib/debts/view";
import { useUpdateDebtMutation } from "@/lib/queries/debts";
import { CreditLineFormFields } from "./credit-line-form-fields";

export interface CreditLineSettingsDialogProps {
  line: CreditLineView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SettingsForm({ line, onDone }: { line: CreditLineView; onDone: () => void }) {
  const mutation = useUpdateDebtMutation();
  const [state, setState] = React.useState<CreditLineFormState>(() => creditLineFormFromView(line));
  const [error, setError] = React.useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const problem = validateCreditLineForm(state, false);
    if (problem) return setError(problem);
    setError(null);
    mutation.mutate({ id: line.id, input: buildCreditLineSettingsPatch(state) }, { onSuccess: onDone, onError: (e) => setError(e.message) });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <CreditLineFormFields state={state} onChange={setState} creating={false} />
      {error ? (
        <p className="text-sm text-neg" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Salvo…" : "Salva le impostazioni"}
      </Button>
    </form>
  );
}

export function CreditLineSettingsDialog({ line, open, onOpenChange }: CreditLineSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Impostazioni della linea</DialogTitle>
          <DialogDescription>Se la banca alza il fido o cambia lo spread, aggiornalo qui. Il valore dell&apos;indice si cambia con «Cambio tasso».</DialogDescription>
        </DialogHeader>
        {open ? <SettingsForm line={line} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
