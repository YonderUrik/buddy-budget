"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Connects the first-steps checklist, its «Cambia» sheet and the sample-data offer to state and API (container). */

import * as React from "react";
import { track } from "@/lib/analytics";
import { isCountryPathAvailable } from "@/lib/localization/config";
import { countDoneSteps, focusOptionsFor, shouldShowChecklist, startStepDefinitionsFor, type StartStatus } from "@/lib/start";
import { useRecentSteps } from "@/lib/start/progress";
import { useStartDemoMutation, useStartDismissMutation, useStartFocusMutation, useStartSkipMutation } from "@/lib/queries/start";
import { FocusSheet } from "./focus-sheet";
import { StartChecklist } from "./start-checklist";

export interface StartChecklistSectionProps {
  status: StartStatus;
  /** Shows the checklist even if closed, with the sample-data offer (Panoramica with no data yet). */
  forceVisible?: boolean;
  className?: string;
}

/** First-steps checklist: hidden when closed, complete or while exploring sample data. */
export function StartChecklistSection({ status, forceVisible, className }: StartChecklistSectionProps) {
  const { productCountry } = useLocalization();
  const dismiss = useStartDismissMutation();
  const demo = useStartDemoMutation();
  const saveFocus = useStartFocusMutation();
  const skip = useStartSkipMutation();
  const recent = useRecentSteps();
  const [focusOpen, setFocusOpen] = React.useState(false);
  const visible = forceVisible ? !status.completed && !status.demoActive : shouldShowChecklist(status);

  if (!visible) return null;
  return (
    <>
      <StartChecklist
        steps={status.steps}
        stepIds={status.stepIds}
        skipped={status.skipped}
        definitions={startStepDefinitionsFor()}
        justDone={recent.filter((id) => status.stepIds.includes(id) && status.steps[id])}
        demo={forceVisible ? { onStart: () => demo.mutate(), pending: demo.isPending, errorMessage: demo.error?.message } : undefined}
        className={className}
        onStepClick={(step, placement) => track("start_step_clicked", { step, placement })}
        onChangeFocus={() => setFocusOpen(true)}
        onSkip={(step) => skip.mutate({ step, skipped: true })}
        onRestore={(step) => skip.mutate({ step, skipped: false })}
        onDismiss={forceVisible ? undefined : () => dismiss.mutate({ dismissed: true, done: countDoneSteps(status.steps, status.stepIds) })}
        dismissing={dismiss.isPending}
      />
      <FocusSheet
        open={focusOpen}
        onOpenChange={setFocusOpen}
        initial={status.focus ?? []}
        options={focusOptionsFor(isCountryPathAvailable(productCountry, "/pensione"))}
        pending={saveFocus.isPending}
        errorMessage={saveFocus.error?.message}
        onSave={(focus) => saveFocus.mutate(focus, { onSuccess: () => setFocusOpen(false) })}
      />
    </>
  );
}
