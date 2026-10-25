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
import { PAGE_SPLIT, PAGE_SPLIT_MAIN, PAGE_SPLIT_SIDE } from "@/components/domain/shared";

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
          <div className={PAGE_SPLIT}>
            <div className={PAGE_SPLIT_MAIN}>
              <DebtsUpcomingCard items={data.overview.nextDue} debts={data.debts} currency={currency} />
              <DebtsListCard debts={data.debts} currency={currency} />
            </div>
            <div className={PAGE_SPLIT_SIDE}>
              <DebtsExitCard debts={data.debts} currency={currency} />
              <DebtsInterestCard interest={interest} currency={currency} />
            </div>
          </div>
        </div>
      ) : null}
    </DebtsViewGate>
  );
}
