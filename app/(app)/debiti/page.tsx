"use client";

/**
 * Panoramica dei debiti, in ordine di cosa serve: le prossime rate (da segnare), dove si pagano più interessi, come uscirne
 * prima con un extra e l'elenco dei debiti che porta al dettaglio.
 */

import * as React from "react";
import { DebtsExitCard, DebtsHero, DebtsInterestCard, DebtsListCard, DebtsUpcomingCard, DebtsViewGate } from "@/components/domain/debts";
import { authClient } from "@/lib/auth/client";
import { yearlyInterestShares } from "@/lib/debts/overview-insights";
import { useDebtsQuery } from "@/lib/queries/debts";

export default function DebitiPage() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const query = useDebtsQuery();
  const data = query.data;
  const interest = React.useMemo(() => (data ? yearlyInterestShares(data.debts) : null), [data]);
  const open = React.useMemo(() => (data ? data.debts.filter((d) => !d.plan.totals.finished) : []), [data]);
  const freeDate = open.map((d) => d.plan.totals.endDate).sort().at(-1);

  return (
    <DebtsViewGate loading={query.isLoading} error={query.isError} empty={data?.debts.length === 0} onRetry={() => query.refetch()}>
      {data && interest ? (
        <div className="flex flex-col gap-8 sm:gap-10">
          <DebtsHero totalDebt={data.overview.totalDebt} currency={currency} openCount={open.length} freeDate={freeDate} />
          <div className="grid grid-cols-1 items-start gap-x-10 gap-y-10 lg:grid-cols-5">
            <div className="flex min-w-0 flex-col gap-10 lg:col-span-3">
              <DebtsUpcomingCard items={data.overview.nextDue} debts={data.debts} currency={currency} />
              <DebtsListCard debts={data.debts} currency={currency} />
            </div>
            <div className="flex min-w-0 flex-col gap-10 lg:col-span-2">
              <DebtsExitCard debts={data.debts} currency={currency} />
              <DebtsInterestCard interest={interest} currency={currency} />
            </div>
          </div>
        </div>
      ) : null}
    </DebtsViewGate>
  );
}
