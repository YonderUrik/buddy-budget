"use client";

import * as React from "react";
import { GoalDialog, ScenarioView } from "@/components/domain/analytics";
import { track } from "@/lib/analytics";
import { useAnalytics } from "@/lib/analitiche/analytics-context";
import { GOAL_PARAM } from "@/lib/start";

export default function AnalitichePage() {
  const { base, assumptions, plan, saving, saveError, saveAssumptions, today } = useAnalytics();
  const [goalOpen, setGoalOpen] = React.useState(false);

  // Il link dei primi passi (?traguardo=1) apre subito «Il tuo traguardo», una volta sola.
  React.useEffect(() => {
    if (!new URLSearchParams(window.location.search).has(GOAL_PARAM)) return;
    // Il parametro si toglie solo allo scoccare del timer: in Strict Mode il primo effetto viene annullato e il secondo deve ritrovarlo.
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      params.delete(GOAL_PARAM);
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
      setGoalOpen(true);
      track("analytics_goal_opened", { from: "primi-passi" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!base || !assumptions || !plan) return null;
  // Si rimonta quando cambiano le ipotesi salvate (non il TER, che si salva dal pannello costi), per non tenere cursori su valori vecchi.
  const key = JSON.stringify({ ...assumptions, terByInstrument: undefined });
  return (
    <>
      <ScenarioView
        key={key}
        base={base}
        assumptions={assumptions}
        plan={plan}
        saving={saving}
        saveError={saveError}
        today={today}
        onSaveAssumptions={saveAssumptions}
        onSaveTer={(terByInstrument) => saveAssumptions({ terByInstrument })}
      />
      <GoalDialog
        open={goalOpen}
        onOpenChange={setGoalOpen}
        base={base}
        assumptions={assumptions}
        plan={plan}
        saving={saving}
        error={saveError}
        today={today}
        onSave={saveAssumptions}
        onSaved={(source) => track("analytics_goal_saved", { source })}
      />
    </>
  );
}
