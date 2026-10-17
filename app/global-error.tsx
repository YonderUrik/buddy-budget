"use client";

import "./globals.css";
import { PageError } from "@/components/domain/shared";

/**
 * Errore nel layout radice: sostituisce tutto il documento, quindi ha i suoi `<html>` e `<body>` e importa gli stili.
 * Niente link di segnalazione: il foglio vive nel layout autenticato, che qui non c'è.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="it">
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <title>BuddyBudget non si è caricato</title>
        <PageError
          error={error}
          onRetry={retry}
          kind="globale"
          title="BuddyBudget non si è caricato"
          description="Qualcosa è andato storto da parte nostra. I tuoi dati non sono stati toccati: ricarica la pagina, e se succede ancora scrivici a support@buddybudget.io."
          showReport={false}
        />
      </body>
    </html>
  );
}
