"use client";

import { QuestionsView } from "@/components/domain/analytics";
import { useAnalytics } from "@/lib/analitiche/analytics-context";

export default function AnalitichePage() {
  const { base, assumptions, plan, saving, saveError, saveAssumptions } = useAnalytics();
  if (!base || !assumptions || !plan) return null;
  return <QuestionsView base={base} assumptions={assumptions} plan={plan} saving={saving} saveError={saveError} onSaveTer={(terByInstrument) => saveAssumptions({ terByInstrument })} />;
}
