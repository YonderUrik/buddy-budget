"use client";

/** Form di creazione di una linea di credito (credit Lombard, fido): fido, utilizzo iniziale, tasso e regole di addebito. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { buildCreateCreditLineInput, validateCreditLineForm, type CreditLineFormState } from "@/lib/debts/credit-line-form";
import { useCreateCreditLineMutation } from "@/lib/queries/debts";
import { CreditLineFormFields } from "./credit-line-form-fields";

export interface AddCreditLineFormProps {
  state: CreditLineFormState;
  onChange: (state: CreditLineFormState) => void;
  onBack: () => void;
  onCreated: () => void;
}

export function AddCreditLineForm({ state, onChange, onBack, onCreated }: AddCreditLineFormProps) {
  const mutation = useCreateCreditLineMutation();
  const [error, setError] = React.useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const problem = validateCreditLineForm(state, true);
    if (problem) return setError(problem);
    setError(null);
    mutation.mutate(buildCreateCreditLineInput(state), { onSuccess: onCreated, onError: (e) => setError(e.message) });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <CreditLineFormFields state={state} onChange={onChange} creating />
      {error ? (
        <p className="text-sm text-neg" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Indietro
        </Button>
        <Button type="submit" className="flex-1" disabled={mutation.isPending}>
          {mutation.isPending ? "Salvo…" : "Aggiungi la linea"}
        </Button>
      </div>
    </form>
  );
}
