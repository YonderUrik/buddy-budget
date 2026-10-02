"use client";

/**
 * Simulazione locale dell'aliquota in uscita: l'utente sposta il chip lungo la linea del tempo e le stime del netto si
 * ricalcolano con quegli anni di partecipazione. Nulla viene salvato né inviato al server (solo l'evento di utilizzo).
 */

import * as React from "react";
import { track } from "@/lib/analytics";
import { EXIT_TAX_TIMELINE_YEARS, exitTaxRate, wholeYearsBetween, withdrawalScenarios, type WithdrawalScenario } from "@/lib/calc/pension";

export interface RateSimulationInput {
  adhesionDate: string | null;
  today: string;
  /** Ultima fotografia del fondo (null se non ce ne sono). */
  last: { value: number; netContributions: number } | null;
}

export interface RateSimulation {
  /** Anni di partecipazione reali alla data di oggi. */
  realYears: number;
  /** Anni usati per i calcoli: quelli simulati se c'è una simulazione, altrimenti quelli reali. */
  years: number;
  isSimulated: boolean;
  rate: number;
  scenarios: WithdrawalScenario[];
  /** Stime con gli anni reali, per mostrare la differenza. */
  baseline: WithdrawalScenario[];
  setYears: (years: number) => void;
  /** Da chiamare a fine gesto (rilascio o fine digitazione): registra l'uso. */
  commit: () => void;
  reset: () => void;
}

/** Stato e calcoli della simulazione dell'aliquota. Si azzera da solo quando cambia il fondo (data di adesione). */
export function useRateSimulation({ adhesionDate, today, last }: RateSimulationInput): RateSimulation {
  const realYears = adhesionDate ? wholeYearsBetween(adhesionDate, today) : 0;
  const [state, setState] = React.useState<{ adhesionDate: string | null; years: number } | null>(null);
  const simulated = state && state.adhesionDate === adhesionDate && state.years !== realYears ? state.years : null;
  const years = simulated ?? realYears;

  const setYears = React.useCallback(
    (next: number) => setState({ adhesionDate, years: Math.min(EXIT_TAX_TIMELINE_YEARS, Math.max(0, Math.round(next))) }),
    [adhesionDate],
  );
  const reset = React.useCallback(() => setState(null), []);
  const commit = () => {
    if (simulated !== null) track("pension_rate_simulated", { years: simulated });
  };

  const baseline = React.useMemo(() => (last ? withdrawalScenarios(last.value, last.netContributions, adhesionDate, today) : []), [last, adhesionDate, today]);
  const scenarios = React.useMemo(
    () => (last && simulated !== null ? withdrawalScenarios(last.value, last.netContributions, adhesionDate, today, simulated) : baseline),
    [last, simulated, adhesionDate, today, baseline],
  );

  return { realYears, years, isSimulated: simulated !== null, rate: exitTaxRate(years), scenarios, baseline, setYears, commit, reset };
}
