"use client";

/**
 * Dialog per registrare un evento semplice (data + un valore): per un finanziamento il cambio di tasso o la correzione del
 * residuo, per una linea di credito anche utilizzi, rimborsi e interessi realmente addebitati.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { parseAmount } from "@/lib/debts/add-form";
import { todayIso } from "@/lib/debts/dates";
import { useCreateDebtEventMutation } from "@/lib/queries/debts";
import { DebtFormField } from "./debt-form-field";

export type DebtEventDialogKind = "rate_change" | "balance_correction" | "draw" | "repay" | "interest_charged";

interface EventCopy {
  title: string;
  description: string;
  label: string;
  hint: string;
  submit: string;
  dateLabel: string;
}

const LINE_COPY: Record<DebtEventDialogKind, EventCopy> = {
  draw: {
    title: "Utilizzo",
    description: "Hai prelevato dalla linea: gli interessi maturano su questo importo dal giorno indicato.",
    label: "Importo utilizzato",
    hint: "Quanto hai preso in più",
    submit: "Registra utilizzo",
    dateLabel: "Data",
  },
  repay: {
    title: "Rimborso",
    description: "Hai restituito una parte dell'utilizzato: da quel giorno gli interessi calano.",
    label: "Importo rimborsato",
    hint: "Non può superare il saldo utilizzato",
    submit: "Registra rimborso",
    dateLabel: "Data",
  },
  interest_charged: {
    title: "Interessi addebitati",
    description: "Scrivi quanto ha realmente addebitato la banca: prende il posto della nostra stima per quel periodo.",
    label: "Importo addebitato",
    hint: "Lo trovi sull'estratto conto",
    submit: "Registra l'addebito",
    dateLabel: "Data dell'addebito",
  },
  rate_change: {
    title: "Cambio dell'indice",
    description: "Dalla data indicata gli interessi maturano al nuovo indice più il tuo spread.",
    label: "Nuovo valore dell'indice (%)",
    hint: "Per un tasso fisso, il nuovo tasso",
    submit: "Registra il nuovo indice",
    dateLabel: "Dalla data",
  },
  balance_correction: {
    title: "Correggi il saldo",
    description: "Se il saldo utilizzato reale è diverso dal nostro calcolo, indicalo: da quel giorno si riparte da lì.",
    label: "Saldo utilizzato reale",
    hint: "Lo trovi sull'estratto o nell'area clienti (anche 0)",
    submit: "Correggi il saldo",
    dateLabel: "Alla data",
  },
};

const COPY: Record<DebtEventDialogKind, EventCopy> = {
  ...LINE_COPY,
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
  /** Per una linea di credito il testo parla di indice e saldo invece di tasso e residuo. */
  creditLine?: boolean;
  /** Tipo di evento; null = dialog chiuso. */
  kind: DebtEventDialogKind | null;
  onOpenChange: (open: boolean) => void;
}

function EventForm({ debtId, kind, creditLine, onDone }: { debtId: string; kind: DebtEventDialogKind; creditLine: boolean; onDone: () => void }) {
  const mutation = useCreateDebtEventMutation();
  const [date, setDate] = React.useState(todayIso());
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();
  const copy = (creditLine ? LINE_COPY : COPY)[kind];

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const number = parseAmount(value);
    const mayBeZero = creditLine && (kind === "balance_correction" || kind === "interest_charged");
    if (number === undefined || number < 0 || (number === 0 && !mayBeZero && kind !== "rate_change")) return setError("Inserisci un valore valido");
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

export function DebtEventDialog({ debtId, creditLine = false, kind, onOpenChange }: DebtEventDialogProps) {
  const copy = kind ? (creditLine ? LINE_COPY : COPY)[kind] : null;
  return (
    <Dialog open={kind !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{copy?.title ?? ""}</DialogTitle>
          {copy ? <DialogDescription>{copy.description}</DialogDescription> : null}
        </DialogHeader>
        {kind ? <EventForm key={kind} debtId={debtId} kind={kind} creditLine={creditLine} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
