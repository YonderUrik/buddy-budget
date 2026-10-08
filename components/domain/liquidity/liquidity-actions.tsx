"use client";

/** Azioni globali di Liquidità (nuovo conto, rinnovo del collegamento, nuovo movimento) esposte alle schede senza passare props. */

import * as React from "react";

export interface LiquidityActions {
  addAccount: () => void;
  /** Apre il flusso di rinnovo; `source` finisce nell'evento Umami. */
  renew: (source: "banner" | "row") => void;
  addTransaction: () => void;
}

const LiquidityActionsContext = React.createContext<LiquidityActions | null>(null);

export const LiquidityActionsProvider = LiquidityActionsContext.Provider;

/** Azioni di Liquidità; da usare solo sotto `LiquidityShell`. */
export function useLiquidityActions(): LiquidityActions {
  const context = React.useContext(LiquidityActionsContext);
  if (!context) throw new Error("useLiquidityActions va usato dentro LiquidityShell");
  return context;
}
