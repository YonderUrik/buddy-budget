/**
 * Percorso numerato dell'import: su schermi larghi i passi con etichetta e filo, su telefono «Passo 2 di 4» con una
 * barra a segmenti (le etichette non ci stanno). Sotto, una frase che dice cosa si fa nel passo corrente.
 */

import { cn } from "@/lib/utils";
import { DialogSteps } from "../dialog-parts";
import { IMPORT_STEPS, IMPORT_STEP_HINTS, IMPORT_STEP_LABELS, type ImportStep } from "./investment-import.state";

export interface ImportStepperProps {
  current: ImportStep;
  className?: string;
}

export function ImportStepper({ current, className }: ImportStepperProps) {
  const index = IMPORT_STEPS.indexOf(current);
  const labels = IMPORT_STEPS.map((step) => IMPORT_STEP_LABELS[step]);
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <DialogSteps steps={labels} current={index} ariaLabel="Passi dell'import" className="hidden sm:flex" />
      <div className="flex flex-col gap-2 sm:hidden" role="group" aria-label="Passi dell'import">
        <p className="text-sm font-medium text-foreground" aria-current="step">
          Passo {index + 1} di {IMPORT_STEPS.length} · {labels[index]}
        </p>
        <div className="flex gap-1.5" aria-hidden="true">
          {IMPORT_STEPS.map((step, i) => (
            <span key={step} className={cn("h-1 flex-1 rounded-full", i <= index ? "bg-primary" : "bg-border")} />
          ))}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{IMPORT_STEP_HINTS[current]}</p>
    </div>
  );
}
