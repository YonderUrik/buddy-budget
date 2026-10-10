"use client";

/** Liquidità · Abbonamenti: gli addebiti ricorrenti trovati nei movimenti, da confermare o scartare, con il costo al mese. */

import * as React from "react";
import { LoadError } from "@/components/domain/shared";
import { SubscriptionsOverview } from "@/components/domain/subscriptions";
import { track } from "@/lib/analytics";
import { useSubscriptionsQuery } from "@/lib/queries/subscriptions";

export default function LiquiditaAbbonamentiPage() {
  const { data, isLoading, isError, refetch } = useSubscriptionsQuery();
  React.useEffect(() => track("liquidity_tab_viewed", { tab: "abbonamenti" }), []);

  if (isLoading) return <div className="h-64 max-w-3xl animate-pulse rounded-2xl bg-muted" aria-busy="true" />;
  if (isError || !data) return <LoadError message="Impossibile caricare gli abbonamenti." onRetry={() => refetch()} />;
  return <SubscriptionsOverview data={data} onItemOpened={(item) => track("subscription_details_opened", { decision: item.decision })} />;
}
