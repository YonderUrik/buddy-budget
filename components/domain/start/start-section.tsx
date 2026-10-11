"use client";

/** Collega la checklist e l'offerta dei dati d'esempio a stato e API (container: nessun markup proprio oltre alle due sezioni). */

import { track } from "@/lib/analytics";
import { countDoneSteps, shouldShowChecklist, type StartStatus } from "@/lib/start";
import { useStartDemoMutation, useStartDismissMutation } from "@/lib/queries/start";
import { DemoOffer } from "./demo-offer";
import { StartChecklist } from "./start-checklist";

export interface StartChecklistSectionProps {
  status: StartStatus;
  /** Mostra la checklist anche se chiusa (Panoramica ancora senza dati). */
  forceVisible?: boolean;
  className?: string;
}

/** Checklist dei primi passi: sparisce se chiusa, completa o in demo. */
export function StartChecklistSection({ status, forceVisible, className }: StartChecklistSectionProps) {
  const dismiss = useStartDismissMutation();
  const visible = forceVisible ? !status.completed && !status.demoActive : shouldShowChecklist(status);
  if (!visible) return null;
  return (
    <StartChecklist
      steps={status.steps}
      className={className}
      onStepClick={(step) => track("start_step_clicked", { step })}
      onDismiss={forceVisible ? undefined : () => dismiss.mutate({ dismissed: true, done: countDoneSteps(status.steps) })}
      dismissing={dismiss.isPending}
    />
  );
}

/** Offerta «Esplora con dati d'esempio»: avvia la demo e ricarica i dati. */
export function DemoOfferSection({ className }: { className?: string }) {
  const start = useStartDemoMutation();
  return <DemoOffer className={className} onStart={() => start.mutate()} pending={start.isPending} errorMessage={start.error?.message} />;
}
