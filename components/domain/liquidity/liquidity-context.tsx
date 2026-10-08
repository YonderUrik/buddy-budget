"use client";

/**
 * Stato condiviso dalle schede di Liquidità: periodo e data di riferimento (Movimenti e Analisi), conto filtrato,
 * categoria e testo di ricerca. Vive nel layout, così cambiando scheda le scelte restano.
 */

import * as React from "react";
import type { ExpensePeriod } from "@/lib/calc/expenses";

export interface LiquidityState {
  period: ExpensePeriod;
  setPeriod: (period: ExpensePeriod) => void;
  referenceDate: Date;
  setReferenceDate: (date: Date) => void;
  /** Data reale corrente, indipendente dal periodo guardato. */
  today: Date;
  /** Conto di cui si guardano saldo e movimenti (null = tutti). */
  accountId: string | null;
  setAccountId: (accountId: string | null) => void;
  categoryId: string | null;
  setCategoryId: (categoryId: string | null) => void;
  searchText: string;
  setSearchText: (text: string) => void;
}

const LiquidityContext = React.createContext<LiquidityState | null>(null);

/** Finestra di fetch dei movimenti: dal 1° gennaio dell'anno precedente al 31 dicembre, così il cambio periodo non rifà richieste. */
export function liquidityFetchWindow(referenceDate: Date): { from: string; to: string } {
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: key(new Date(referenceDate.getFullYear() - 1, 0, 1)), to: key(new Date(referenceDate.getFullYear(), 11, 31)) };
}

export function LiquidityProvider({
  children,
  initialAccountId = null,
  initialPeriod = "mese",
}: {
  children: React.ReactNode;
  initialAccountId?: string | null;
  initialPeriod?: ExpensePeriod;
}) {
  const [period, setPeriod] = React.useState<ExpensePeriod>(initialPeriod);
  const [referenceDate, setReferenceDate] = React.useState<Date>(() => new Date());
  const [accountId, setAccountId] = React.useState<string | null>(initialAccountId);
  const [categoryId, setCategoryId] = React.useState<string | null>(null);
  const [searchText, setSearchText] = React.useState("");
  const today = React.useMemo(() => new Date(), []);
  const value = React.useMemo<LiquidityState>(
    () => ({ period, setPeriod, referenceDate, setReferenceDate, today, accountId, setAccountId, categoryId, setCategoryId, searchText, setSearchText }),
    [period, referenceDate, today, accountId, categoryId, searchText]
  );
  return <LiquidityContext.Provider value={value}>{children}</LiquidityContext.Provider>;
}

/** Stato di Liquidità; da usare solo sotto `LiquidityProvider`. */
export function useLiquidity(): LiquidityState {
  const context = React.useContext(LiquidityContext);
  if (!context) throw new Error("useLiquidity va usato dentro LiquidityProvider");
  return context;
}
