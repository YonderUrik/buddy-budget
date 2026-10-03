"use client";

import { FireTab } from "@/components/domain/analytics";
import { useAnalytics } from "@/lib/analitiche/analytics-context";

export default function FirePage() {
  const { base, assumptions, plan } = useAnalytics();
  if (!base || !assumptions || !plan) return null;
  return <FireTab base={base} assumptions={assumptions} plan={plan} />;
}
