"use client";
import { localizedFormats } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";

/** Connects the «Dall'ultima visita» summary to its query, formatters and events (container). */

import * as React from "react";
import { track } from "@/lib/analytics";
import { useWelcomeDismissMutation } from "@/lib/queries/welcome";
import type { WelcomeResponse } from "@/lib/welcome";
import { happenedLine, sinceLabel, waitingLine } from "./welcome-lines";
import { WelcomeSummary } from "./welcome-summary";

export interface WelcomeSectionProps {
  data: WelcomeResponse | undefined;
  className?: string;
}

/** Shows the summary when there is one; tracks it once per summary (the `since` of the visit). */
export function WelcomeSection({ data, className }: WelcomeSectionProps) {
  const { t: tr, locale } = useLocalization();
  const { formatCurrency, formatPrice } = localizedFormats(locale);
  const dismiss = useWelcomeDismissMutation();
  const summary = data?.summary ?? null;
  const currency = data?.currency ?? "EUR";

  const trackedSince = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!summary || trackedSince.current === summary.since) return;
    trackedSince.current = summary.since;
    track("welcome_summary_shown", { happened: summary.happened.length, waiting: summary.waiting.length });
  }, [summary]);

  if (!summary) return null;
  const fmt = {
    money: (value: number) => formatCurrency(value, currency, { maximumFractionDigits: Math.abs(value) < 100 ? 2 : 0 }),
    price: formatPrice,
  };
  const happened = summary.happened.map((item) => happenedLine(item, tr, fmt));
  const waiting = summary.waiting.map((item) => waitingLine(item, tr));
  return (
    <WelcomeSummary
      sinceLabel={sinceLabel(new Date(summary.since), new Date(), locale, tr)}
      happened={happened}
      waiting={waiting}
      onItemClick={(item) => track("welcome_summary_item_clicked", { item })}
      onDismiss={() => dismiss.mutate({ items: happened.length + waiting.length })}
      dismissing={dismiss.isPending}
      className={className}
    />
  );
}
