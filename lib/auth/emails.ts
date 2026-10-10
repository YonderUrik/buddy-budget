import { renderEmail } from "@/lib/email";

/** Oggetto, testo e HTML dell'email con il link di accesso. Pura, per poterla testare. */
export function magicLinkEmailContent(params: { url: string; expiresInMinutes: number; appUrl: string }): { subject: string; text: string; html: string } {
  return {
    subject: "Il tuo link di accesso a BuddyBudget",
    ...renderEmail(
      {
        title: "Accesso",
        lead: `Usa il pulsante per entrare in BuddyBudget. Il link vale **${params.expiresInMinutes} minuti** e funziona una sola volta.`,
        preheader: `Il link scade tra ${params.expiresInMinutes} minuti.`,
        cta: { label: "Accedi", url: params.url },
        footnote: "Se non l'hai chiesto tu, ignora questa email: senza il link nessuno può entrare.",
      },
      { appUrl: params.appUrl },
    ),
  };
}
