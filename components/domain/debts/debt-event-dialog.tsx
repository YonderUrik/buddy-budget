"use client";

/**
 * Dialog per registrare un evento semplice (data + un valore): il cambio di tasso o la correzione del residuo.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { parseAmount } from "@/lib/debts/add-form";
import { todayIso } from "@/lib/debts/dates";
import { useCreateDebtEventMutation } from "@/lib/queries/debts";
import { DebtFormField } from "./debt-form-field";

export type DebtEventDialogKind = "rate_change" | "balance_correction";

interface EventCopy {
  title: string;
  description: string;
  label: string;
  hint: string;
  submit: string;
  dateLabel: string;
}

const COPY: Record<DebtEventDialogKind, EventCopy> = {
  rate_change: {
    title: "Cambio di tasso",
    description: "Dalla data indicata le rate si ricalcolano al nuovo tasso, con lo stesso numero di rate.",
    label: "Nuovo tasso annuo (TAN, %)",
    hint: "Quello scritto dalla banca",
    submit: "Registra cambio tasso",
    dateLabel: "Dalla data",
  },
  balance_correction: {
    title: "Correggi il residuo",
    description: "Se il residuo reale è diverso da quello del piano (rate saltate, sospensioni, estinzioni parziali), indicalo: il piano riparte da lì.",
    label: "Capitale residuo reale",
    hint: "Lo trovi sull'estratto o nell'area clienti della banca",
    submit: "Correggi il residuo",
    dateLabel: "Dalla data",
  },
};

export interface DebtEventDialogProps {
  debtId: string;
  /** Tipo di evento; null = dialog chiuso. */
  kind: DebtEventDialogKind | null;
  onOpenChange: (open: boolean) => void;
}

function EventForm({ debtId, kind, onDone }: { debtId: string; kind: DebtEventDialogKind; onDone: () => void }) {
  const mutation = useCreateDebtEventMutation();
  const [date, setDate] = React.useState(todayIso());
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();
  const copy = COPY[kind];

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const number = parseAmount(value);
    if (number === undefined || number < 0 || (number === 0 && kind !== "rate_change")) return setError("Inserisci un valore valido");
    setError(null);
    const input = kind === "rate_change" ? ({ type: "rate_change", date, rate: number } as const) : ({ type: kind, date, amount: number } as const);
    mutation.mutate({ debtId, input }, { onSuccess: onDone, onError: (e) => setError(e.message) });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <DebtFormField label={copy.dateLabel} htmlFor={`${id}-date`}>
          <Input id={`${id}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </DebtFormField>
        <DebtFormField label={copy.label} htmlFor={`${id}-value`} hint={copy.hint}>
          <Input id={`${id}-value`} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
        </DebtFormField>
      </div>
      {error ? <p className="text-sm text-neg" role="alert">{error}</p> : null}
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Salvo…" : copy.submit}
      </Button>
    </form>
  );
}

export function DebtEventDialog({ debtId, kind, onOpenChange }: DebtEventDialogProps) {
  const copy = kind ? COPY[kind] : null;
  return (
    <Dialog open={kind !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{copy?.title ?? ""}</DialogTitle>
          {copy ? <DialogDescription>{copy.description}</DialogDescription> : null}
        </DialogHeader>
        {kind ? <EventForm key={kind} debtId={debtId} kind={kind} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
