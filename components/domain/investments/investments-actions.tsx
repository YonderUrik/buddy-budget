"use client";

/**
 * Azioni condivise dalle schede di Investimenti (Portafoglio, Proventi, Tasse): aprire il dialog "Registra operazione"
 * precompilato e l'import. I dialog vivono nel layout, così ogni scheda li usa senza duplicarli.
 */

import * as React from "react";
import { resolvePrice } from "@/lib/calc/investments";
import { toDateKey } from "@/lib/calc/net-worth";
import type { InvestmentPlan } from "@/lib/db/schema/investments";
import type { InvestmentsView } from "@/lib/investments/view";
import type { RegisterOperationInitial } from "./register-operation-form";
import { prefillFromPlan } from "./register-operation-form.state";

export interface InvestmentsActions {
  openRegister: (initial: RegisterOperationInitial) => void;
  openImport: () => void;
}

const InvestmentsActionsContext = React.createContext<InvestmentsActions | null>(null);

export function InvestmentsActionsProvider({ value, children }: { value: InvestmentsActions; children: React.ReactNode }) {
  return <InvestmentsActionsContext.Provider value={value}>{children}</InvestmentsActionsContext.Provider>;
}

/** Azioni del layout di Investimenti; fuori dal layout lancia (errore di programmazione). */
export function useInvestmentsActions(): InvestmentsActions {
  const actions = React.useContext(InvestmentsActionsContext);
  if (!actions) throw new Error("useInvestmentsActions va usato dentro il layout di Investimenti");
  return actions;
}

/**
 * Apre "Registra operazione" precompilato da un PAC o da un suggerimento d'acquisto (strumento e importo): quote
 * stimate dall'ultimo prezzo.
 */
export function useRegisterFromPlan(view: InvestmentsView | null, today: Date) {
  const { openRegister } = useInvestmentsActions();
  return React.useCallback(
    (plan: Pick<InvestmentPlan, "instrumentId" | "amount">) => {
      if (!view) return;
      const last = resolvePrice(view.priceIndex, plan.instrumentId, toDateKey(today));
      const prefill = prefillFromPlan(plan, last?.close ?? null);
      openRegister({ ...prefill, instrument: view.instrumentsById.get(plan.instrumentId) ?? null });
    },
    [view, today, openRegister]
  );
}
