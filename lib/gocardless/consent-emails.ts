import "server-only";
import { sendEmail } from "@/lib/email/send";
import { emailLocale, renderEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/env";
import type { Language } from "@/lib/localization/config";
import { hashUserId, logger, recordConsentNotice, type ConsentNoticeKind } from "@/lib/observability";

/** Percorso (relativo all'app) a cui portano le email: apre direttamente il flusso di rinnovo in Conti. */
export const RENEW_PATH = "/liquidita/conti?rinnova=1";

/**
 * Subject, text and HTML of the bank consent notices, in `params.language` (Italian by default) with the date in its
 * locale. Pure, so it can be tested.
 */
export function consentEmailContent(
  kind: ConsentNoticeKind,
  params: { institutionName: string; appUrl: string; expiresAt?: Date | null; language?: Language }
): { subject: string; text: string; html: string } {
  const { t, locale, language } = emailLocale(params.language);
  const bank = params.institutionName;
  const cta = { label: t("Rinnova il collegamento"), url: `${params.appUrl}${RENEW_PATH}` };
  const footnote = t("Ricevi questa email perché hai collegato un conto con Open Banking.");
  if (kind === "expiring") {
    const lead = params.expiresAt
      ? t(
          "Il consenso a leggere i tuoi conti di {0} scade **il {1}**. Rinnovarlo richiede un minuto. Se non lo fai, i dati restano in BuddyBudget ma saldi e movimenti smettono di aggiornarsi.",
          bank,
          new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" }).format(params.expiresAt),
        )
      : t("Il consenso a leggere i tuoi conti di {0} scade **a breve**. Rinnovarlo richiede un minuto. Se non lo fai, i dati restano in BuddyBudget ma saldi e movimenti smettono di aggiornarsi.", bank);
    return {
      subject: t("Il collegamento con {0} sta per scadere", bank),
      ...renderEmail({ title: t("Collegamento bancario in scadenza"), lead, cta, footnote }, { appUrl: params.appUrl, language }),
    };
  }
  return {
    subject: t("Il collegamento con {0} è scaduto", bank),
    ...renderEmail(
      {
        title: t("Collegamento bancario scaduto"),
        lead: t("Il collegamento con {0} non è più attivo: saldi e movimenti non si aggiornano. Rinnovalo per riprendere la sincronizzazione, i dati già importati non vanno persi.", bank),
        cta,
        footnote,
      },
      { appUrl: params.appUrl, language },
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
  context: { userId: string; institutionName: string; expiresAt?: Date | null; language?: Language }
): Promise<boolean> {
  try {
    const { subject, text, html } = consentEmailContent(kind, {
      institutionName: context.institutionName,
      expiresAt: context.expiresAt,
      appUrl: getAppUrl(),
      language: context.language,
    });
    const result = await sendEmail({ to, subject, text, html });
    if (!result.ok) {
      // Only the error type: the provider's message can contain the address.
      logger.warn("gocardless.consent_notice.failed", { user: hashUserId(context.userId), reason: `${kind}:${result.reason}` });
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
