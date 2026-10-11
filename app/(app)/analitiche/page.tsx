"use client";

import { ScenarioView } from "@/components/domain/analytics";
import { useAnalytics } from "@/lib/analitiche/analytics-context";

export default function AnalitichePage() {
  const { base, assumptions, plan, saving, saveError, saveAssumptions, today } = useAnalytics();
  if (!base || !assumptions || !plan) return null;
  // Si rimonta quando cambiano le ipotesi salvate (non il TER, che si salva dal pannello costi), per non tenere cursori su valori vecchi.
  const key = JSON.stringify({ ...assumptions, terByInstrument: undefined });
  return (
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
  );
}
