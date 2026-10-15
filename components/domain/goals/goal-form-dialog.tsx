"use client";

/**
 * Dialog «Nuovo obiettivo» / «Modifica obiettivo»: cinque passi (tipo, quanto e quando, fonti, quota e posizione,
 * riepilogo), a tutto schermo sul telefono. In modifica si può partire da un passo preciso (es. «Aggiungi soldi» apre
 * le fonti) e la posizione si cambia dalla lista, non qui.
 */

import * as React from "react";
import { TargetIcon } from "lucide-react";
import { PanelDialogHeader } from "@/components/domain/investments/light";
import { FormDialogContent, StepActions, StepProgress, StepStage, useStepFlow } from "@/components/domain/shared";
import { ErrorWithReport } from "@/components/domain/support";
import { Dialog } from "@/components/ui/dialog";
import { track } from "@/lib/analytics";
import type { GoalKind } from "@/lib/goals/constants";
import type { GoalView, GoalsView } from "@/lib/goals/view";
import { useLocalization } from "@/lib/localization/provider";
import { availableSources, canAdvance, GOAL_FORM_STEPS, initialDraft, sourceKey, toPayload, withKind, type GoalDraft, type GoalFormStep } from "./goal-form-state";
import type { GoalFormatters } from "./goal-format";
import { GoalAmountStep } from "./goal-amount-step";
import { GoalKindStep } from "./goal-kind-step";
import { GoalPaceStep } from "./goal-pace-step";
import { GoalSourcesStep } from "./goal-sources-step";
import { GoalSummaryStep } from "./goal-summary-step";

export interface GoalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: GoalsView;
  todayKey: string;
  fmt: GoalFormatters;
  /** Obiettivo da modificare; null = nuovo. */
  goal?: GoalView | null;
  /** Passo da cui partire (solo in modifica). */
  startStep?: GoalFormStep;
  /** Se vero, il riepilogo propone di accendere i promemoria via email (spenti oggi). */
  offerReminders?: boolean;
  /** Chiamata dopo l'invio se l'utente ha lasciato acceso «Ricordamelo per email». */
  onEnableReminders?: () => void;
  /** Tipo già scelto per un obiettivo nuovo (es. dal consiglio del fondo di emergenza). */
  presetKind?: GoalKind | null;
  pending: boolean;
  error: string | null;
  onSubmit: (draft: ReturnType<typeof toPayload>) => void;
}

function GoalForm({ view, todayKey, fmt, goal = null, startStep = "tipo", presetKind = null, offerReminders = false, onEnableReminders, pending, error, onSubmit }: Omit<GoalFormDialogProps, "open" | "onOpenChange">) {
  const { t: tr } = useLocalization();
  const editing = goal !== null;
  const [draft, setDraft] = React.useState<GoalDraft>(() => {
    const initial = initialDraft(goal, view.goals.length);
    return !goal && presetKind ? withKind(initial, presetKind, view.essentialMonthly) : initial;
  });
  const [remind, setRemind] = React.useState(true);
  const flow = useStepFlow(GOAL_FORM_STEPS.length, editing ? GOAL_FORM_STEPS.indexOf(startStep) : 0);
  const step = GOAL_FORM_STEPS[flow.index];
  const patch = (next: Partial<GoalDraft>) => setDraft((d) => ({ ...d, ...next }));
  const sources = React.useMemo(() => availableSources(view, goal), [view, goal]);
  const sourceNames = React.useMemo(() => Object.fromEntries(sources.map((s) => [sourceKey(s.kind, s.id), s.name])), [sources]);
  const others = view.goals.filter((g) => g.id !== goal?.id);
  const taken = others.filter((g) => g.status !== "raggiunto").reduce((sum, g) => sum + g.funded, 0);
  const capacity = view.capacity === null ? null : { total: Math.max(0, view.capacity), taken };
  const ok = canAdvance(step, draft, todayKey);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ok || pending) return;
        if (!flow.isLast) {
          track("form_step_completed", { flow: "goal", step: flow.index + 1 });
          flow.next();
          return;
        }
        onSubmit(toPayload(draft));
        if (offerReminders && remind) onEnableReminders?.();
      }}
    >
      <StepProgress index={flow.index} count={flow.count} label={tr("Passi del nuovo obiettivo")} />
      <StepStage stepKey={step} direction={flow.direction} className="flex flex-col gap-4">
        {step === "tipo" ? <GoalKindStep draft={draft} onKind={(kind) => setDraft((d) => withKind(d, kind, view.essentialMonthly))} onName={(name) => patch({ name })} /> : null}
        {step === "quanto" ? <GoalAmountStep draft={draft} currency={view.currency} todayKey={todayKey} essentialMonthly={view.essentialMonthly} capacity={capacity} fmt={fmt} onChange={patch} /> : null}
        {step === "fonti" ? <GoalSourcesStep draft={draft} sources={sources} currency={view.currency} fmt={fmt} onChange={(s) => patch({ sources: s })} /> : null}
        {step === "ritmo" ? <GoalPaceStep draft={draft} currency={view.currency} todayKey={todayKey} others={editing ? undefined : others} capacity={capacity} fmt={fmt} onChange={patch} /> : null}
        {step === "riepilogo" ? <GoalSummaryStep draft={draft} fmt={fmt} sourceNames={sourceNames} reminders={offerReminders ? { checked: remind, onChange: setRemind } : undefined} /> : null}
      </StepStage>
      {error ? <ErrorWithReport area="obiettivo" error={error} /> : null}
      <StepActions
        backLabel={flow.isFirst ? undefined : tr("Indietro")}
        onBack={() => {
          track("form_step_back", { flow: "goal", step: flow.index + 1 });
          flow.back();
        }}
        primaryLabel={flow.isLast ? (pending ? tr("Salvataggio…") : editing ? tr("Salva") : tr("Crea obiettivo")) : tr("Avanti")}
        disabled={!ok}
        pending={pending}
      />
    </form>
  );
}

export function GoalFormDialog({ open, onOpenChange, goal = null, ...rest }: GoalFormDialogProps) {
  const { t: tr } = useLocalization();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogContent>
        <PanelDialogHeader
          className="pr-10"
          icon={TargetIcon}
          color="var(--swatch-amber)"
          title={goal ? tr("Modifica obiettivo") : tr("Nuovo obiettivo")}
          description={goal ? goal.name : tr("Una cosa per cui mettere da parte: il risparmio del mese la raggiunge nell'ordine che scegli.")}
        />
        {open ? <GoalForm key={`${goal?.id ?? "new"}-${rest.startStep ?? ""}-${rest.presetKind ?? ""}`} goal={goal} {...rest} /> : null}
      </FormDialogContent>
    </Dialog>
  );
}
