"use client";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface BrokerSelection { disabled: ReadonlySet<string>; toggle: (id: string) => void; showAll: () => void }
const DEFAULT: BrokerSelection = { disabled: new Set(), toggle: () => {}, showAll: () => {} };
const Context = createContext<BrokerSelection>(DEFAULT);

/** Temporary investment-view selection shared across tabs; never modifies the user's financial records. */
export function BrokerSelectionProvider({ children }: { children: ReactNode }) {
  const [disabled, setDisabled] = useState<ReadonlySet<string>>(new Set());
  const value = useMemo(() => ({ disabled,
    toggle: (id: string) => setDisabled((old) => { const next = new Set(old); if (next.has(id)) next.delete(id); else next.add(id); return next; }),
    showAll: () => setDisabled(new Set()),
  }), [disabled]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Read the active broker selection, or the unfiltered default outside Investment pages. */
export function useBrokerSelection() { return useContext(Context); }
