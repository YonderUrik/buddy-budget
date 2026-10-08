import "server-only";
import { Resend } from "resend";
import { getAppUrl } from "@/lib/env";
import { hashUserId, logger, recordConsentNotice, type ConsentNoticeKind } from "@/lib/observability";

/** Percorso (relativo all'app) a cui portano le email: apre direttamente il flusso di rinnovo in Conti. */
export const RENEW_PATH = "/liquidita/conti?rinnova=1";

const DATE_FORMAT = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" });

/** Oggetto e testo degli avvisi sul consenso bancario. Pura, per poterla testare. */
export function consentEmailContent(
  kind: ConsentNoticeKind,
  params: { institutionName: string; appUrl: string; expiresAt?: Date | null }
): { subject: string; text: string } {
  const link = `${params.appUrl}${RENEW_PATH}`;
  if (kind === "expiring") {
    const when = params.expiresAt ? `il ${DATE_FORMAT.format(params.expiresAt)}` : "a breve";
    return {
      subject: `Il collegamento con ${params.institutionName} sta per scadere`,
      text:
        `Il consenso che hai dato a BuddyBudget per leggere i conti di ${params.institutionName} scade ${when}.\n\n` +
        `Per continuare a ricevere saldi e movimenti in automatico, rinnovalo ora: ci vuole un minuto.\n` +
        `${link}\n\n` +
        `Se non lo rinnovi, i tuoi dati restano in BuddyBudget ma i conti smettono di aggiornarsi.`,
    };
  }
  return {
    subject: `Il collegamento con ${params.institutionName} è scaduto`,
    text:
      `Il collegamento di BuddyBudget con ${params.institutionName} non è più attivo: saldi e movimenti non si aggiornano.\n\n` +
      `Rinnovalo per riprendere la sincronizzazione (i dati già importati non vanno persi):\n` +
      `${link}`,
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
    const { subject, text } = consentEmailContent(kind, {
      institutionName: context.institutionName,
      expiresAt: context.expiresAt,
      appUrl: getAppUrl(),
    });
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: process.env.RESEND_FROM!, to, subject, text });
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
