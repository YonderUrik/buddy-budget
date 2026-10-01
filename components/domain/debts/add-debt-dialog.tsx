"use client";

/** Dialog "Aggiungi debito": prima la scelta nuovo/in corso, poi i dati con il calcolatore della variabile mancante. */

import * as React from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { emptyAddDebtForm, type AddDebtFormState } from "@/lib/debts/add-form";
import { emptyCreditLineForm, type CreditLineFormState } from "@/lib/debts/credit-line-form";
import { todayIso } from "@/lib/debts/dates";
import { AddCreditLineForm } from "./add-credit-line-form";
import { AddDebtDetailsForm } from "./add-debt-details-form";
import { AddDebtKindStep, type AddDebtKind } from "./add-debt-kind-step";
import { AddDebtStartStep } from "./add-debt-start-step";

export interface AddDebtDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: string;
}

const STEP_COPY = {
  kind: { title: "Aggiungi un debito", description: "Che tipo di debito è?" },
  line: { title: "I dati della linea di credito", description: "Fido, tasso e regole di addebito: le trovi sul contratto." },
  start: { title: "Aggiungi un debito", description: "Il finanziamento parte adesso o è già in corso?" },
  details: { title: "I dati del finanziamento", description: "Bastano tre dati su quattro: il quarto lo calcoliamo noi." },
} as const;

function AddDebtFlow({ currency, onClose }: { currency: string; onClose: () => void }) {
  const [kind, setKind] = React.useState<AddDebtKind | null>(null);
  const [state, setState] = React.useState<AddDebtFormState | null>(null);
  const [lineState, setLineState] = React.useState<CreditLineFormState | null>(null);
  const step = kind === null ? "kind" : lineState ? "line" : state ? "details" : "start";
  const done = () => {
    toast.success(kind === "credit_line" ? "Linea di credito aggiunta" : "Debito aggiunto");
    onClose();
  };
  return (
    <>
      <DialogHeader>
        <DialogTitle>{STEP_COPY[step].title}</DialogTitle>
        <DialogDescription>{STEP_COPY[step].description}</DialogDescription>
      </DialogHeader>
      {step === "kind" ? (
        <AddDebtKindStep
          onChoose={(chosen) => {
            setKind(chosen);
            if (chosen === "credit_line") setLineState(emptyCreditLineForm(todayIso()));
          }}
        />
      ) : null}
      {step === "line" && lineState ? (
        <AddCreditLineForm
          state={lineState}
          onChange={setLineState}
          onBack={() => {
            setLineState(null);
            setKind(null);
          }}
          onCreated={done}
        />
      ) : null}
      {step === "start" ? <AddDebtStartStep onChoose={(mode) => setState(emptyAddDebtForm(mode))} /> : null}
      {step === "details" && state ? (
        <AddDebtDetailsForm state={state} onChange={setState} currency={currency} onBack={() => setState(null)} onCreated={done} />
      ) : null}
    </>
  );
}

export function AddDebtDialog({ open, onOpenChange, currency }: AddDebtDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        {/* Il flusso si rimonta a ogni apertura: niente dati rimasti dall'ultima volta. */}
        {open ? <AddDebtFlow currency={currency} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
