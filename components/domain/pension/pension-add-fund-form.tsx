"use client";

/** Form per aggiungere un fondo di previdenza in due passi: il nome, poi la data di prima adesione a una forma pensionistica. */

import * as React from "react";
import { StepActions, StepHeading, StepProgress, StepStage, useStepFlow } from "@/components/domain/shared";
import { track } from "@/lib/analytics";
import { Input } from "@/components/ui/input";
import { ErrorWithReport } from "@/components/domain/support";

export interface PensionAddFundFormProps {
  /** Data di oggi `YYYY-MM-DD`: limite massimo della data di adesione. */
  today: string;
  onSubmit: (input: { name: string; adhesionDate: string }) => void;
  pending?: boolean;
  errorMessage?: string | null;
  /** Nome proposto all'inizio. */
  defaultName?: string;
}

export function PensionAddFundForm({ today, onSubmit, pending = false, errorMessage = null, defaultName = "" }: PensionAddFundFormProps) {
  const [name, setName] = React.useState(defaultName);
  const [adhesionDate, setAdhesionDate] = React.useState("");
  const flow = useStepFlow(2);
  const canContinue = flow.isLast ? name.trim() !== "" && adhesionDate !== "" && !pending : name.trim() !== "";
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!canContinue) return;
        if (!flow.isLast) {
          track("form_step_completed", { flow: "pension_fund", step: flow.index + 1 });
          flow.next();
          return;
        }
        onSubmit({ name: name.trim(), adhesionDate });
      }}
      className="flex flex-col gap-4"
    >
      <StepProgress index={flow.index} count={flow.count} label="Passi del nuovo fondo" />
      <StepStage stepKey={flow.index} direction={flow.direction} className="flex flex-col gap-3">
        {flow.index === 0 ? (
          <>
            <StepHeading title="Come si chiama il fondo?" />
            <label className="flex min-w-0 flex-col gap-1.5 text-sm text-text-2">
              Nome del fondo
              <Input data-autofocus value={name} placeholder="es. Piano pensione Moneyfarm" maxLength={80} onChange={(e) => setName(e.target.value)} />
            </label>
          </>
        ) : (
          <>
            <StepHeading title="Quando hai aderito?" description="Conta la prima adesione in assoluto a una forma pensionistica, anche in un'altra azienda: decide l'aliquota in uscita." />
            <label className="flex min-w-0 flex-col gap-1.5 text-sm text-text-2">
              Data di prima adesione
              <Input data-autofocus type="date" value={adhesionDate} max={today} onChange={(e) => setAdhesionDate(e.target.value)} />
            </label>
          </>
        )}
      </StepStage>
      {errorMessage ? <ErrorWithReport area="pensione" error={errorMessage} /> : null}
      <StepActions
        backLabel={flow.isFirst ? undefined : "Indietro"}
        onBack={() => {
          track("form_step_back", { flow: "pension_fund", step: flow.index + 1 });
          flow.back();
        }}
        primaryLabel={flow.isLast ? (pending ? "Salvataggio…" : "Aggiungi il fondo") : "Continua"}
        disabled={!canContinue}
        pending={pending}
      />
    </form>
  );
}
