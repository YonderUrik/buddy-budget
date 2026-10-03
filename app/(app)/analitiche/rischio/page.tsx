"use client";

import { RiskTab } from "@/components/domain/analytics";
import { useAnalytics } from "@/lib/analitiche/analytics-context";

export default function RischioPage() {
  const { base, assumptions, plan } = useAnalytics();
  if (!base || !assumptions || !plan) return null;
  return <RiskTab base={base} assumedVolatility={assumptions.volatility} />;
}
