"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setAmountsMasked } from "@/lib/format";

interface PrivacyContextValue {
  /** Vero se l'utente ha scelto di nascondere tutti gli importi. */
  hidden: boolean;
  /** Inverte la preferenza e la salva sul profilo dell'utente. */
  toggle: () => void;
}

const PrivacyContext = React.createContext<PrivacyContextValue>({ hidden: false, toggle: () => {} });

/** Stato "importi nascosti" e azione per invertirlo; fuori dal provider vale `hidden: false`. */
export function usePrivacy(): PrivacyContextValue {
  return React.useContext(PrivacyContext);
}

interface PrivacyProviderProps {
  /** Preferenza salvata, letta lato server così il primo render è già corretto. */
  initialHidden: boolean;
  children: React.ReactNode;
}

/**
 * Preferenza globale "nascondi importi": attiva la maschera di `formatCurrency`, marca `<html data-privacy>` (i grafici
 * si sfocano da CSS) e salva la scelta nel profilo. Va montato sopra tutto ciò che mostra importi.
 */
export function PrivacyProvider({ initialHidden, children }: PrivacyProviderProps) {
  const [hidden, setHidden] = React.useState(initialHidden);
  const queryClient = useQueryClient();

  // Va impostato durante il render, prima che i figli formattino: un effetto arriverebbe dopo il primo disegno.
  // Solo nel browser: sul server la variabile sarebbe condivisa tra richieste di utenti diversi.
  if (typeof window !== "undefined") setAmountsMasked(hidden);

  React.useEffect(() => {
    document.documentElement.dataset.privacy = hidden ? "hidden" : "visible";
  }, [hidden]);

  const toggle = React.useCallback(() => {
    const next = !hidden;
    setHidden(next);
    void fetch("/api/user/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hideAmounts: next }),
    })
      .then((response) => {
        if (!response.ok) throw new Error("save failed");
        return queryClient.invalidateQueries({ queryKey: ["user-settings"] });
      })
      .catch(() => setHidden(!next));
  }, [hidden, queryClient]);

  const value = React.useMemo(() => ({ hidden, toggle }), [hidden, toggle]);
  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

/**
 * Rimonta il contenuto quando la preferenza cambia: gli importi sono stringhe già formattate dentro componenti che
 * non si accorgerebbero del cambio. I dati restano in cache, quindi non ci sono nuove richieste.
 */
export function PrivacyBoundary({ children }: { children: React.ReactNode }) {
  const { hidden } = usePrivacy();
  return <React.Fragment key={hidden ? "hidden" : "visible"}>{children}</React.Fragment>;
}
