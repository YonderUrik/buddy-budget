"use client";

/**
 * Formula mostrata nella barra in alto delle pagine di accesso (`AuthSheet`). Una pagina la imposta con
 * `useSheetFormula` (es. il login scrive `=ACCEDI("email")` mentre digiti); senza, la barra mostra quella di default.
 */

import * as React from "react";

export interface SheetFormula {
  /** Nome della funzione, in maiuscolo come nei fogli di calcolo. */
  fn: string;
  /** Argomento testuale, mostrato tra virgolette. */
  arg?: string;
}

const SetFormulaContext = React.createContext<(formula: SheetFormula | null) => void>(() => {});

/** Fornisce alla pagina il modo di cambiare la formula della barra; usato da `AuthSheet`. */
export const SheetFormulaProvider = SetFormulaContext.Provider;

/** Imposta la formula della barra finché il componente resta montato. */
export function useSheetFormula(formula: SheetFormula | null) {
  const setFormula = React.useContext(SetFormulaContext);
  const fn = formula?.fn;
  const arg = formula?.arg;
  React.useEffect(() => {
    setFormula(fn ? { fn, arg } : null);
    return () => setFormula(null);
  }, [setFormula, fn, arg]);
}
