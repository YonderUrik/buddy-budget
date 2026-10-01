"use client";

/** Panoramica dei debiti: quanto resta e quanto costa, quanto costa ciascun debito, quando finiscono e le prossime rate. */

import * as React from "react";
import { DebtsCostCard, DebtsCreditLinesCard, DebtsNextDueCard, DebtsSummaryCard, DebtsTimelineCard, DebtsViewGate } from "@/components/domain/debts";
import { authClient } from "@/lib/auth/client";
import { todayIso } from "@/lib/debts/dates";
import { buildDebtTimeline } from "@/lib/debts/timeline";
import { useDebtsQuery } from "@/lib/queries/debts";

export default function DebitiPage() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const query = useDebtsQuery();
  const data = query.data;
  const timeline = React.useMemo(() => (data ? buildDebtTimeline(data.debts, todayIso()) : null), [data]);

  return (
    <DebtsViewGate loading={query.isLoading} error={query.isError} empty={data?.debts.length === 0 && data.creditLines.length === 0} onRetry={() => query.refetch()}>
      {data ? (
        <>
          <DebtsSummaryCard overview={data.overview} currency={currency} />
          <DebtsCostCard debts={data.debts} currency={currency} />
          <DebtsCreditLinesCard lines={data.creditLines} currency={currency} />
          <DebtsTimelineCard timeline={timeline} currency={currency} />
          <DebtsNextDueCard items={data.overview.nextDue} currency={currency} />
        </>
      ) : null}
    </DebtsViewGate>
  );
}
