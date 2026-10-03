"use client";

import { CostsTab } from "@/components/domain/analytics";
import { useAnalytics } from "@/lib/analitiche/analytics-context";

export default function CostiPage() {
  const { base, assumptions, plan, saving, saveError, saveAssumptions } = useAnalytics();
  if (!base || !assumptions || !plan) return null;
  return (
    <CostsTab base={base} assumptions={assumptions} plan={plan} saving={saving} error={saveError} onSaveTer={(terByInstrument) => saveAssumptions({ terByInstrument })} />
  );
}
