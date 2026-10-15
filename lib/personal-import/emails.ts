import { renderEmail } from "@/lib/email";

/** Oggetto, testo e HTML dell'email sull'esito dell'import CSV personale. Pura, per poterla testare. */
export type PersonalImportEmailOutcome = "imported" | "review" | "failed" | "correction_ready" | "correction_failed";
export function personalImportEmailContent(outcome: PersonalImportEmailOutcome, params: { jobUrl: string; appUrl: string }): { subject: string; text: string; html: string } {
  if (outcome === "correction_ready" || outcome === "correction_failed") {
    const ready = outcome === "correction_ready";
    return { subject: ready ? "La correzione del CSV è pronta da confrontare" : "La correzione del CSV richiede attenzione", ...renderEmail({ title: ready ? "Confronta la correzione" : "Correzione non completata", lead: "L’importazione originale è rimasta invariata. Apri BuddyBudget per controllare il risultato: i dati saranno sostituiti solo dopo la tua conferma.", cta: { label: "Controlla la correzione", url: params.jobUrl } }, { appUrl: params.appUrl }) };
  }
  if (outcome === "imported") {
    return {
      subject: "Il tuo CSV è stato importato",
      ...renderEmail(
        {
          title: "Importazione completata",
          lead: "Il tuo CSV è stato importato. Trovi i dati in **Liquidità** e **Investimenti**.",
          cta: { label: "Apri BuddyBudget", url: params.jobUrl },
        },
        { appUrl: params.appUrl },
      ),
    };
  }
  if (outcome === "review") {
    return {
      subject: "Il tuo CSV ha righe da controllare",
      ...renderEmail(
        {
          title: "Alcune righe da controllare",
          lead: "Alcune righe del tuo CSV non sono state riconosciute e nessun movimento è stato salvato. In BuddyBudget vedi quali righe e perché, e scegli se importare le altre, rianalizzare il file o caricarne uno corretto.",
          cta: { label: "Vedi le righe", url: params.jobUrl },
        },
        { appUrl: params.appUrl },
      ),
    };
  }
  return {
    subject: "Non è stato possibile importare il tuo CSV",
    ...renderEmail(
      {
        title: "Importazione non riuscita",
        lead: "Non è stato possibile importare il tuo CSV: nessun movimento è stato salvato. Apri BuddyBudget per vedere il motivo.",
        cta: { label: "Vedi il motivo", url: params.jobUrl },
      },
      { appUrl: params.appUrl },
    ),
  };
}
