"use client";

/**
 * Stato condiviso dalle schede di Movimenti (Elenco, Analisi): periodo guardato, data di riferimento e filtri
 * categoria/testo. Vive nel layout, così cambiando scheda il periodo e i filtri restano quelli scelti.
 */

import * as React from "react";
import type { ExpensePeriod } from "@/lib/calc/expenses";

export interface MovementsState {
  period: ExpensePeriod;
  setPeriod: (period: ExpensePeriod) => void;
  referenceDate: Date;
  setReferenceDate: (date: Date) => void;
  /** Data reale corrente, indipendente dal periodo guardato. */
  today: Date;
  categoryFilter: string | null;
  setCategoryFilter: (categoryId: string | null) => void;
  searchText: string;
  setSearchText: (text: string) => void;
}

const MovementsContext = React.createContext<MovementsState | null>(null);

/** Provider dello stato di Movimenti; `initialPeriod` è il periodo all'apertura (default: mese). */
export function MovementsProvider({
  children,
  initialPeriod = "mese",
}: {
  children: React.ReactNode;
  initialPeriod?: ExpensePeriod;
}) {
  const [period, setPeriod] = React.useState<ExpensePeriod>(initialPeriod);
  const [referenceDate, setReferenceDate] = React.useState<Date>(() => new Date());
  const [categoryFilter, setCategoryFilter] = React.useState<string | null>(null);
  const [searchText, setSearchText] = React.useState("");
  const today = React.useMemo(() => new Date(), []);

  const value = React.useMemo<MovementsState>(
    () => ({ period, setPeriod, referenceDate, setReferenceDate, today, categoryFilter, setCategoryFilter, searchText, setSearchText }),
    [period, referenceDate, today, categoryFilter, searchText]
  );
  return <MovementsContext.Provider value={value}>{children}</MovementsContext.Provider>;
}

/** Stato di Movimenti; da usare solo sotto `MovementsProvider`. */
export function useMovements(): MovementsState {
  const context = React.useContext(MovementsContext);
  if (!context) throw new Error("useMovements va usato dentro MovementsProvider");
  return context;
}

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Finestra di fetch: dal 1° gennaio dell'anno precedente al 31 dicembre — copre "anno", il confronto col periodo prima e i grafici mensili. */
export function movementsFetchWindow(referenceDate: Date): { from: string; to: string } {
  return {
    from: toDateString(new Date(referenceDate.getFullYear() - 1, 0, 1)),
    to: toDateString(new Date(referenceDate.getFullYear(), 11, 31)),
  };
}
