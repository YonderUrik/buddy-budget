"use client";

/** Dialog "Aggiungi debito": prima la scelta nuovo/in corso, poi i dati con il calcolatore della variabile mancante. */

import * as React from "react";
import { toast } from "sonner";
import { LandmarkIcon } from "lucide-react";
import { PanelDialogHeader } from "@/components/domain/investments/light";
import { StepProgress, StepStage, useStepFlow, FormDialogContent } from "@/components/domain/shared";
import { track } from "@/lib/analytics";
import { Dialog } from "@/components/ui/dialog";
import { emptyAddDebtForm, type AddDebtFormState } from "@/lib/debts/add-form";
import { AddDebtDetailsForm } from "./add-debt-details-form";
import { AddDebtStartStep } from "./add-debt-start-step";

export interface AddDebtDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: string;
}

/** Come parte, nome e data, dati del finanziamento, spese e conferma. */
const ADD_DEBT_STEPS = 4;

const STEP_COPY = {
  start: { title: "Aggiungi un debito", description: "Il finanziamento parte adesso o è già in corso?" },
  details: { title: "Aggiungi un debito", description: "Un passo alla volta: bastano tre dati su quattro, il quarto lo calcoliamo noi." },
} as const;

function AddDebtFlow({ currency, onClose }: { currency: string; onClose: () => void }) {
  const [state, setState] = React.useState<AddDebtFormState | null>(null);
  const flow = useStepFlow(ADD_DEBT_STEPS);
  const step = state ? "details" : "start";
  const done = () => {
    toast.success("Debito aggiunto");
    onClose();
  };
  return (
    <>
      <PanelDialogHeader icon={LandmarkIcon} title={STEP_COPY[step].title} description={STEP_COPY[step].description} />
      <StepProgress index={flow.index} count={flow.count} label="Passi per aggiungere un debito" />
      <StepStage stepKey={step === "start" ? "start" : `details-${flow.index}`} direction={flow.direction} className="flex flex-col gap-5">
        {step === "start" ? (
          <AddDebtStartStep
            onChoose={(mode) => {
              track("form_step_completed", { flow: "debt_add", step: 1 });
              setState(emptyAddDebtForm(mode));
              flow.next();
            }}
          />
        ) : null}
        {step === "details" && state ? (
          <AddDebtDetailsForm
            state={state}
            onChange={setState}
            currency={currency}
            part={flow.index - 1}
            onNext={() => {
              track("form_step_completed", { flow: "debt_add", step: flow.index + 1 });
              flow.next();
            }}
            onBack={() => {
              track("form_step_back", { flow: "debt_add", step: flow.index + 1 });
              if (flow.index === 1) setState(null);
              flow.back();
            }}
            onCreated={done}
          />
        ) : null}
      </StepStage>
    </>
  );
}

export function AddDebtDialog({ open, onOpenChange, currency }: AddDebtDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogContent>
        {/* Il flusso si rimonta a ogni apertura: niente dati rimasti dall'ultima volta. */}
        {open ? <AddDebtFlow currency={currency} onClose={() => onOpenChange(false)} /> : null}
      </FormDialogContent>
    </Dialog>
  );
}
