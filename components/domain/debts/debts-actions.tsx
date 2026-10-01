"use client";

import * as React from "react";

export interface DebtsActions {
  /** Apre il dialog "Aggiungi debito". */
  openAdd: () => void;
}

const DebtsActionsContext = React.createContext<DebtsActions | null>(null);

export const DebtsActionsProvider = DebtsActionsContext.Provider;

/** Azioni condivise dalle schede di Debiti (il dialog vive nel layout). */
export function useDebtsActions(): DebtsActions {
  const value = React.useContext(DebtsActionsContext);
  if (!value) throw new Error("useDebtsActions va usato dentro DebtsActionsProvider");
  return value;
}
