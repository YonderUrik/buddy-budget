"use client";

/**
 * LegalAcceptancePanel
 *
 * Mostrato a chi ha già un account quando i Termini e la Privacy cambiano (o non sono mai stati accettati):
 * finché non accetta, il proxy lo riporta qui. Offre anche l'export dei dati e l'uscita.
 */

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { track } from "@/lib/analytics";
import { LegalConsentFields } from "./legal-consent-fields";
import { useLegalConsent } from "./use-legal-consent";

export interface LegalAcceptancePanelProps {
  /** Dove andare dopo l'accettazione. Default: la home (pagina iniziale dell'utente). */
  afterAccept?: string;
}

export function LegalAcceptancePanel({ afterAccept = "/" }: LegalAcceptancePanelProps) {
  const { consent, setConsent, complete, payload } = useLegalConsent();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function accept() {
    if (!payload) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/user/legal-acceptance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        track("terms_accepted", { context: "aggiornamento" });
        window.location.assign(afterAccept);
        return;
      }
      setError("Non siamo riusciti a registrare l'accettazione. Riprova.");
    } catch {
      setError("Connessione non riuscita. Controlla la rete e riprova.");
    }
    setLoading(false);
  }

  async function signOut() {
    await authClient.signOut().catch(() => undefined);
    window.location.assign("/login");
  }

  return (
    <div className="flex flex-col gap-8 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-medium tracking-tight">Abbiamo aggiornato Termini e Privacy</h1>
        <p className="text-text-2">
          Per continuare a usare BuddyBudget leggi i documenti e accettali. Se non vuoi accettare puoi scaricare i tuoi dati ed eliminare l&apos;account.
        </p>
      </div>

      <LegalConsentFields value={consent} onChange={setConsent} disabled={loading} />

      {error && (
        <p className="rounded-lg bg-neg-soft p-3 text-sm text-neg" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <Button type="button" className="h-11 w-full text-base" disabled={!complete || loading} onClick={() => void accept()}>
          {loading && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
          {loading ? "Salvataggio in corso…" : "Accetta e continua"}
        </Button>
        <Button type="button" variant="outline" className="h-11 w-full" onClick={() => void signOut()} disabled={loading}>
          Esci
        </Button>
        <a href="/api/user/export" className="text-center text-sm text-text-3 underline underline-offset-2 hover:text-foreground">
          Scarica i miei dati
        </a>
      </div>
    </div>
  );
}
