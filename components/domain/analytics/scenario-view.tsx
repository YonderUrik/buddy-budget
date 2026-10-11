"use client";

/**
 * Corpo di Analitiche: titolo con l'anno del traguardo, quattro cursori «e se…», le quattro risposte e il grafico della
 * risposta scelta. I cursori provano le ipotesi senza salvarle; «Tutte le ipotesi» apre il modulo completo.
 */

import * as React from "react";
import { CalendarClock, Percent, ShieldCheck, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { track } from "@/lib/analytics";
import type { AnalyticsAssumptions, UpdateAssumptionsInput } from "@/lib/analitiche/assumptions";
import type { AnalyticsBase } from "@/lib/analitiche/base";
import { resolvePlan, type AnalyticsPlan } from "@/lib/analitiche/plan";
import { applyScenario, hasScenario, SCENARIO_FIELDS, type ScenarioField, type ScenarioOverrides } from "@/lib/analitiche/scenario";
import { buildSimulationInput } from "@/lib/analitiche/simulation";
import { summarizeCosts } from "@/lib/calc/costs";
import { compareRules } from "@/lib/calc/monte-carlo";
import { AnswerViews, type AnswerView } from "./answer-views";
import { ANALYTICS_QUESTIONS } from "./analytics-questions";
import { money, pct } from "./analytics-format";
import { AssumptionsPanel } from "./assumptions-panel";
import { CostsSection } from "./costs-section";
import { JourneySection } from "./journey-section";
import { LastingSection } from "./lasting-section";
import { lastingAnswer } from "./plain-answers";
import { ScenarioControls } from "./scenario-controls";
import { ScenarioHeadline } from "./scenario-headline";
import { TimelineSection } from "./timeline-section";

export interface ScenarioViewProps {
  base: AnalyticsBase;
  /** Ipotesi e piano salvati. */
  assumptions: AnalyticsAssumptions;
  plan: AnalyticsPlan;
  saving: boolean;
  saveError: string | null;
  today: Date;
  onSaveAssumptions: (input: UpdateAssumptionsInput) => Promise<void>;
  onSaveTer: (terByInstrument: Record<string, number>) => Promise<void>;
}

const PANEL_ID = "analytics-view-panel";
const VIEW_ICONS = { "dove-sono": TrendingUp, quando: CalendarClock, reggera: ShieldCheck, costi: Percent } as const;
const VIEW_LABELS = { "dove-sono": "Strada fatta", quando: "Arrivo", reggera: "Regge", costi: "Costi" } as const;

export function ScenarioView({ base, assumptions, plan, saving, saveError, today, onSaveAssumptions, onSaveTer }: ScenarioViewProps) {
  const [overrides, setOverrides] = React.useState<ScenarioOverrides>({});
  const [selected, setSelected] = React.useState<AnswerView["id"]>("quando");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const { currency } = base;

  const scenarioAssumptions = React.useMemo(() => applyScenario(assumptions, overrides), [assumptions, overrides]);
  const scenarioPlan = React.useMemo(() => (hasScenario(overrides) ? resolvePlan(base, scenarioAssumptions) : plan), [base, plan, overrides, scenarioAssumptions]);
  // La simulazione è la parte pesante: rincorre i cursori con un ritardo, così trascinarli resta fluido.
  const deferred = React.useDeferredValue({ assumptions: scenarioAssumptions, plan: scenarioPlan });
  const results = React.useMemo(() => {
    const input = buildSimulationInput(deferred.plan, deferred.assumptions, "oggi");
    return input ? compareRules(input) : null;
  }, [deferred]);
  const lasting = results ? lastingAnswer(results, deferred.assumptions.rule, deferred.assumptions.retirementYears) : null;
  const costs = React.useMemo(() => summarizeCosts(base.positions.map((p) => ({ ...p, ter: assumptions.terByInstrument[p.id] ?? null }))), [base.positions, assumptions.terByInstrument]);

  const views: AnswerView[] = ANALYTICS_QUESTIONS.map((q) => {
    const common = { id: q.id, label: VIEW_LABELS[q.id], icon: VIEW_ICONS[q.id] };
    switch (q.id) {
      case "dove-sono":
        return { ...common, value: scenarioPlan.progress !== null ? pct(Math.min(scenarioPlan.progress, 9.99), 0) : "—", note: scenarioPlan.target !== null ? `${money(scenarioPlan.wealth, currency)} su ${money(scenarioPlan.target, currency)}` : money(scenarioPlan.wealth, currency) };
      case "quando":
        return { ...common, value: scenarioPlan.yearsToFire === null ? "—" : scenarioPlan.yearsToFire === 0 ? "Già qui" : String(today.getFullYear() + Math.ceil(scenarioPlan.yearsToFire)), note: hasScenario(overrides) ? "con i valori dei cursori" : "ai ritmi attuali" };
      case "reggera":
        return { ...common, value: lasting ? pct(lasting.success, 0) : "—", note: lasting ? `su ${assumptions.retirementYears} anni, smettendo oggi` : "serve la spesa annua" };
      case "costi":
        return { ...common, value: costs.totalValue > 0 ? money(costs.annualCost, currency) : "—", note: costs.annualPct !== null ? `${pct(costs.annualPct, 2)} l'anno` : "costo annuo" };
    }
  });

  const changeField = (field: ScenarioField, value: number | undefined) =>
    setOverrides((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[field];
      else next[field] = value;
      return next;
    });

  const sectionData = { base, assumptions: scenarioAssumptions, plan: scenarioPlan, baseline: hasScenario(overrides) ? { assumptions, plan } : undefined };
  const deferredData = { ...sectionData, assumptions: deferred.assumptions, plan: deferred.plan };
  const question = (id: AnswerView["id"]) => ANALYTICS_QUESTIONS.find((q) => q.id === id)!;

  return (
    <div className="flex flex-col gap-8">
      <ScenarioHeadline plan={scenarioPlan} baseline={plan} today={today} />
      <ScenarioControls
        assumptions={assumptions}
        plan={plan}
        currency={currency}
        overrides={overrides}
        onChange={changeField}
        onCommit={(field) => track("analytics_scenario_changed", { field })}
        onReset={() => {
          setOverrides({});
          track("analytics_scenario_reset");
        }}
        onSave={() => {
          const fields = SCENARIO_FIELDS.filter((f) => overrides[f] !== undefined).length;
          onSaveAssumptions(overrides as UpdateAssumptionsInput)
            .then(() => track("analytics_scenario_saved", { fields }))
            .catch(() => undefined);
        }}
        onOpenAllAssumptions={() => setDialogOpen(true)}
        saving={saving}
      />
      {saveError && !dialogOpen ? (
        <p className="text-sm text-neg" role="alert">
          {saveError}
        </p>
      ) : null}
      <div className="flex flex-col gap-6">
        <AnswerViews
          views={views}
          selected={selected}
          onSelect={(id) => {
            setSelected(id);
            track("analytics_view_selected", { view: id });
          }}
          panelId={PANEL_ID}
        />
        <div id={PANEL_ID} role="tabpanel" aria-labelledby={`answer-tab-${selected}`}>
          {selected === "dove-sono" ? <JourneySection question={question("dove-sono")} {...sectionData} /> : null}
          {selected === "quando" ? <TimelineSection question={question("quando")} {...sectionData} /> : null}
          {selected === "reggera" ? <LastingSection question={question("reggera")} {...deferredData} results={results} /> : null}
          {selected === "costi" ? <CostsSection question={question("costi")} {...sectionData} saving={saving} error={saveError} onSaveTer={onSaveTer} /> : null}
        </div>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tutte le ipotesi</DialogTitle>
            <DialogDescription>Quelle che cambi raramente. Si applicano a tutta la pagina e restano salvate.</DialogDescription>
          </DialogHeader>
          <AssumptionsPanel
            assumptions={assumptions}
            plan={plan}
            currency={currency}
            pensionValue={base.wealth.pension}
            saving={saving}
            error={saveError}
            onSave={async (input) => {
              await onSaveAssumptions(input);
              setDialogOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
