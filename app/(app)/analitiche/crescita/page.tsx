"use client";

import { GrowthTab } from "@/components/domain/analytics";
import { useAnalytics } from "@/lib/analitiche/analytics-context";

export default function CrescitaPage() {
  const { base, assumptions, plan } = useAnalytics();
  if (!base || !assumptions || !plan) return null;
  return <GrowthTab base={base} />;
}
