"use client";

import { WithdrawalTab } from "@/components/domain/analytics";
import { useAnalytics } from "@/lib/analitiche/analytics-context";

export default function PrelieviPage() {
  const { base, assumptions, plan } = useAnalytics();
  if (!base || !assumptions || !plan) return null;
  return <WithdrawalTab assumptions={assumptions} plan={plan} currency={base.currency} />;
}
