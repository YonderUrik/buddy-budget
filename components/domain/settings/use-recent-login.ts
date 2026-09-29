"use client";

import * as React from "react";

/** Ogni quanto ricontrollare se l'accesso recente è scaduto mentre la pagina resta aperta. */
const RECHECK_INTERVAL_MS = 15_000;

/**
 * True finché `recentLoginUntil` non è passato. Si aggiorna da solo mentre la pagina è aperta, così le azioni
 * sensibili mostrano la verifica d'identità appena scade la finestra, senza aspettare un 403 dal server.
 */
export function useRecentLogin(recentLoginUntil: string | undefined): boolean {
  const until = recentLoginUntil ? Date.parse(recentLoginUntil) : 0;
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), RECHECK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);
  return now < until;
}
