"use client";

import * as React from "react";
import { startOfDay } from "@/lib/calc/expenses";
import type { NetWorthPeriod } from "@/lib/calc/net-worth";
import { buildInvestmentsView } from "@/lib/investments/view";
import { useInvestmentsOverviewQuery } from "./investments";

/**
 * Dati dell'overview di Investimenti già calcolati per il periodo dato, condivisi dalle schede (Portafoglio,
 * Performance, Diversificazione, Operazioni). fullHistory carica tutti i prezzi per simulazioni dalla prima operazione.
 */
export function useInvestmentsView(period: NetWorthPeriod, fullHistory = false) {
  const today = React.useMemo(() => startOfDay(new Date()), []);
  const overview = useInvestmentsOverviewQuery(fullHistory ? "max" : period);
  const view = React.useMemo(
    () => (overview.data ? buildInvestmentsView(overview.data, period, today) : null),
    [overview.data, period, today]
  );
  return { overview, view, today };
}
