"use client";

/** Dati derivati condivisi dalle schede di Pensione: store del prototipo, fotografie ordinate, rendimento e versamenti. */

import * as React from "react";
import { authClient } from "@/lib/auth/client";
import { companyTfrValue, computePensionPerformance, deriveContributions, recentQuarterlyContribution, sortSnapshots, withdrawalScenarios } from "@/lib/calc/pension";
import { todayIso } from "@/lib/debts/dates";
import { usePensionPrototype } from "./use-pension-prototype";

/** Inflazione annua costante usata per la rivalutazione del TFR in azienda (con i dati veri verrà dall'indice). */
export const ASSUMED_INFLATION = 0.02;

export function usePensionView() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const store = usePensionPrototype();
  const today = todayIso();
  const adhesion = store.profile.adhesionDate || null;
  const snapshots = React.useMemo(() => sortSnapshots(store.snapshots), [store.snapshots]);
  const last = snapshots.at(-1) ?? null;
  const derived = React.useMemo(() => {
    const performance = computePensionPerformance(snapshots, adhesion);
    const contributions = deriveContributions(snapshots, adhesion);
    if (!performance || !last) return { performance: null, contributions, scenarios: [], tfr: null, quarterly: 0 };
    return {
      performance,
      contributions,
      scenarios: withdrawalScenarios(last.value, last.netContributions, adhesion, today),
      tfr: companyTfrValue(contributions, last.date, ASSUMED_INFLATION),
      quarterly: recentQuarterlyContribution(snapshots) ?? 0,
    };
  }, [snapshots, adhesion, last, today]);
  return { store, currency, today, adhesion, snapshots, last, ...derived };
}

export type PensionView = ReturnType<typeof usePensionView>;
