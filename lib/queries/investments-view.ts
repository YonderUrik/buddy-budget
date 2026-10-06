"use client";

import * as React from "react";
import { useBrokerSelection } from "@/lib/investments/broker-selection";
import { filterInvestmentBrokers } from "@/lib/investments/broker-filter";
import { startOfDay } from "@/lib/calc/expenses";
import type { NetWorthPeriod } from "@/lib/calc/net-worth";
import { buildInvestmentsView } from "@/lib/investments/view";
import { useInvestmentsOverviewQuery } from "./investments";

/**
 * Dati dell'overview di Investimenti già calcolati per il periodo dato, condivisi dalle schede (Portafoglio,
 * Performance, Diversificazione, Operazioni). fullHistory carica tutti i prezzi per simulazioni dalla prima operazione.
 */
export function useInvestmentsView(period: NetWorthPeriod, fullHistory = false, chartRange?: { from: string; to: string }) {
  const today = React.useMemo(() => startOfDay(new Date()), []);
  const overview = useFilteredInvestmentsOverview(fullHistory || chartRange ? "max" : period);
  const view = React.useMemo(
    () => (overview.data ? buildInvestmentsView(overview.data, period, today, chartRange) : null),
    [overview.data, period, today, chartRange]
  );
  return { overview, view, today };
}

/** Apply the section's view-only broker selection without contaminating shared server-query caches. */
export function useFilteredInvestmentsOverview(period: NetWorthPeriod) {
  const overview = useInvestmentsOverviewQuery(period);
  const { disabled } = useBrokerSelection();
  const data = React.useMemo(() => overview.data ? filterInvestmentBrokers(overview.data, disabled) : undefined, [overview.data, disabled]);
  return { ...overview, data };
}
