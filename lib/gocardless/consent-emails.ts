import "server-only";
import { Resend } from "resend";
import { renderEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/env";
import { hashUserId, logger, recordConsentNotice, type ConsentNoticeKind } from "@/lib/observability";

/** Percorso (relativo all'app) a cui portano le email: apre direttamente il flusso di rinnovo in Conti. */
export const RENEW_PATH = "/liquidita/conti?rinnova=1";

const DATE_FORMAT = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" });

/** Oggetto, testo e HTML degli avvisi sul consenso bancario. Pura, per poterla testare. */
export function consentEmailContent(
  kind: ConsentNoticeKind,
  params: { institutionName: string; appUrl: string; expiresAt?: Date | null }
): { subject: string; text: string; html: string } {
  const cta = { label: "Rinnova il collegamento", url: `${params.appUrl}${RENEW_PATH}` };
  const footnote = "Ricevi questa email perché hai collegato un conto con Open Banking.";
  if (kind === "expiring") {
    const when = params.expiresAt ? `il ${DATE_FORMAT.format(params.expiresAt)}` : "a breve";
    return {
      subject: `Il collegamento con ${params.institutionName} sta per scadere`,
      ...renderEmail(
        {
          title: "Collegamento bancario in scadenza",
          lead: `Il consenso a leggere i tuoi conti di ${params.institutionName} scade **${when}**. Rinnovarlo richiede un minuto. Se non lo fai, i dati restano in BuddyBudget ma saldi e movimenti smettono di aggiornarsi.`,
          cta,
          footnote,
        },
        { appUrl: params.appUrl },
      ),
    };
  }
  return {
    subject: `Il collegamento con ${params.institutionName} è scaduto`,
    ...renderEmail(
      {
        title: "Collegamento bancario scaduto",
        lead: `Il collegamento con ${params.institutionName} non è più attivo: saldi e movimenti non si aggiornano. Rinnovalo per riprendere la sincronizzazione, i dati già importati non vanno persi.`,
        cta,
        footnote,
      },
      { appUrl: params.appUrl },
    ),
  };
}

/**
 * Invia l'avviso di consenso in scadenza o scaduto. Restituisce true se l'email è partita: il chiamante
 * segna l'avviso come inviato solo in quel caso, così un errore di Resend si ritenta al giro successivo.
 */
export async function sendConsentEmail(
  to: string,
  kind: ConsentNoticeKind,
  context: { userId: string; institutionName: string; expiresAt?: Date | null }
): Promise<boolean> {
  try {
    const { subject, text, html } = consentEmailContent(kind, {
      institutionName: context.institutionName,
      expiresAt: context.expiresAt,
      appUrl: getAppUrl(),
    });
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: process.env.RESEND_FROM!, to, subject, text, html });
    if (error) {
      // Solo il tipo d'errore: il messaggio di Resend può contenere l'indirizzo.
      logger.warn("gocardless.consent_notice.failed", { user: hashUserId(context.userId), reason: `${kind}:${error.name}` });
      recordConsentNotice(kind, "failed");
      return false;
    }
    recordConsentNotice(kind, "sent");
    logger.info("gocardless.consent_notice.sent", { user: hashUserId(context.userId), reason: kind });
    return true;
  } catch (error) {
    logger.warn("gocardless.consent_notice.failed", { user: hashUserId(context.userId), reason: kind, error });
    recordConsentNotice(kind, "failed");
    return false;
  }
}
