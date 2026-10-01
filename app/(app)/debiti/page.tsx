"use client";

/** Panoramica dei debiti: quanto resta, quando finisci, come scende il debito e le prossime rate. */

import { DebtsNextDueCard, DebtsResidualChartCard, DebtsSummaryCard, DebtsViewGate } from "@/components/domain/debts";
import { authClient } from "@/lib/auth/client";
import { useDebtsQuery } from "@/lib/queries/debts";

export default function DebitiPage() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const query = useDebtsQuery();
  const data = query.data;

  return (
    <DebtsViewGate loading={query.isLoading} error={query.isError} empty={data?.debts.length === 0} onRetry={() => query.refetch()}>
      {data ? (
        <>
          <DebtsSummaryCard overview={data.overview} currency={currency} />
          <DebtsResidualChartCard series={data.overview.residualSeries} currency={currency} />
          <DebtsNextDueCard items={data.overview.nextDue} currency={currency} />
        </>
      ) : null}
    </DebtsViewGate>
  );
}
