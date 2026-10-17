"use client";

/**
 * AuthFootLinks
 *
 * Riga in fondo al pannello di accesso: ritorno al sito, la pagina Sicurezza, il codice aperto e le domande frequenti
 * della landing (chi non è ancora entrato non ha la pagina Aiuto dell'app). Ogni clic invia `landing_link_clicked`.
 */

import { ArrowLeft } from "lucide-react";
import { track } from "@/lib/analytics";
import { LANDING_URL } from "@/lib/legal";
import { useLocalization } from "@/lib/localization/provider";

/** Marchio di GitHub (16×16), lo stesso della landing. */
function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

const LINK_CLASS = "inline-flex items-center gap-1 rounded-md outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";

/** Site links at the bottom of the panel (Torna al sito, Sicurezza, Codice aperto, Aiuto); `children` go at the end of the row (the language chooser). */
export function AuthFootLinks({ children }: { children?: React.ReactNode } = {}) {
  const { t: tr } = useLocalization();
  return (
    <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-text-3" aria-label={tr("Link al sito")}>
      <a href={LANDING_URL} onClick={() => track("landing_link_clicked", { from: "back_link" })} className={LINK_CLASS}>
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        {tr("Torna al sito")}
      </a>
      <a href={`${LANDING_URL}/sicurezza`} onClick={() => track("landing_link_clicked", { from: "security" })} className={LINK_CLASS}>
        {tr("Sicurezza")}
      </a>
      <a href={`${LANDING_URL}/#codice`} onClick={() => track("landing_link_clicked", { from: "source" })} className={LINK_CLASS}>
        <GithubMark className="size-3.5" />
        {tr("Codice aperto")}
      </a>
      <a href={`${LANDING_URL}/#domande`} onClick={() => track("landing_link_clicked", { from: "help" })} className={LINK_CLASS}>
        {tr("Aiuto")}
      </a>
      {children}
    </nav>
  );
}
