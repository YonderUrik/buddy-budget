"use client";

/**
 * Stato condiviso delle schede di Pensione: fondi dal server, fondo selezionato e tutto ciò che si calcola dalle sue
 * fotografie (rendimento, stima del netto, confronto col TFR in azienda, versamento medio).
 */

import * as React from "react";
import { authClient } from "@/lib/auth/client";
import {
  companyTfrValue,
  computePensionPerformance,
  deriveContributions,
  recentQuarterlyContribution,
  withdrawalScenarios,
  type CompanyTfrComparison,
  type DerivedContribution,
  type PensionPerformance,
  type WithdrawalScenario,
} from "@/lib/calc/pension";
import { todayIso } from "@/lib/debts/dates";
import { usePensionQuery } from "@/lib/queries/pension";
import type { PensionFundData, PensionSnapshotData } from "./types";

/** Inflazione annua costante usata per la rivalutazione del TFR in azienda (con i dati veri verrà dall'indice). */
export const ASSUMED_INFLATION = 0.02;

export interface PensionContextValue {
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  currency: string;
  today: string;
  funds: PensionFundData[];
  /** Fondo selezionato (il primo se non ne è stato scelto uno), null se l'utente non ne ha. */
  fund: PensionFundData | null;
  selectFund: (id: string) => void;
  snapshots: PensionSnapshotData[];
  last: PensionSnapshotData | null;
  performance: PensionPerformance | null;
  contributions: DerivedContribution[];
  scenarios: WithdrawalScenario[];
  tfr: CompanyTfrComparison | null;
  /** Versamento medio per trimestre degli ultimi 12 mesi (0 se manca lo storico). */
  quarterly: number;
}

const PensionContext = React.createContext<PensionContextValue | null>(null);

export function PensionProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = authClient.useSession();
  const query = usePensionQuery();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const today = todayIso();
  const funds = React.useMemo(() => query.data?.funds ?? [], [query.data]);
  const fund = funds.find((f) => f.id === selectedId) ?? funds[0] ?? null;

  const value = React.useMemo<PensionContextValue>(() => {
    const snapshots = fund?.snapshots ?? [];
    const last = snapshots.at(-1) ?? null;
    const adhesion = fund?.adhesionDate ?? null;
    const performance = computePensionPerformance(snapshots, adhesion);
    const contributions = deriveContributions(snapshots, adhesion);
    return {
      isLoading: query.isLoading,
      isError: query.isError,
      refetch: () => void query.refetch(),
      currency: session?.user.currency ?? "EUR",
      today,
      funds,
      fund,
      selectFund: setSelectedId,
      snapshots,
      last,
      performance,
      contributions,
      scenarios: last ? withdrawalScenarios(last.value, last.netContributions, adhesion, today) : [],
      tfr: last ? companyTfrValue(contributions, last.date, ASSUMED_INFLATION) : null,
      quarterly: recentQuarterlyContribution(snapshots) ?? 0,
    };
  }, [query, session?.user.currency, today, funds, fund]);

  return <PensionContext.Provider value={value}>{children}</PensionContext.Provider>;
}

/** Stato delle schede di Pensione; va usato sotto `PensionProvider`. */
export function usePensionView(): PensionContextValue {
  const context = React.useContext(PensionContext);
  if (!context) throw new Error("usePensionView va usato dentro PensionProvider");
  return context;
}
