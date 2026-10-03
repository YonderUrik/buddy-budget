"use client";

import { SimulationTab } from "@/components/domain/analytics";
import { useAnalytics } from "@/lib/analitiche/analytics-context";

export default function SimulazionePage() {
  const { base, assumptions, plan } = useAnalytics();
  if (!base || !assumptions || !plan) return null;
  return <SimulationTab assumptions={assumptions} plan={plan} currency={base.currency} />;
}
