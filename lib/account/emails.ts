import "server-only";
import { Resend } from "resend";
import { renderEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/env";
import { hashUserId, logger } from "@/lib/observability";
import { DEACTIVATION_GRACE_DAYS } from "./constants";

export type AccountEmailKind = "deactivated" | "deleted";

const DATE_FORMAT = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" });

/** Oggetto, testo e HTML delle email sul ciclo di vita dell'account. Pura, per poterla testare. */
export function accountEmailContent(kind: AccountEmailKind, params: { deletionAt?: Date; appUrl: string }): { subject: string; text: string; html: string } {
  if (kind === "deactivated") {
    const when = params.deletionAt ? DATE_FORMAT.format(params.deletionAt) : `tra ${DEACTIVATION_GRACE_DAYS} giorni`;
    return {
      subject: "Il tuo account BuddyBudget è stato disattivato",
      ...renderEmail(
        {
          title: "Account disattivato",
          lead: `L'account e tutti i tuoi dati verranno eliminati definitivamente il **${when}**. Se cambi idea, accedi prima di quella data e scegli «Riattiva account».`,
          cta: { label: "Riattiva account", url: `${params.appUrl}/login` },
          footnote: "Se non sei stato tu, accedi subito e riattiva l'account.",
        },
        { appUrl: params.appUrl },
      ),
    };
  }
  return {
    subject: "Il tuo account BuddyBudget è stato eliminato",
    ...renderEmail(
      {
        title: "Account eliminato",
        lead: "Conti, transazioni, investimenti, categorie e regole sono stati eliminati definitivamente e i collegamenti con le banche sono stati revocati. Grazie per aver usato BuddyBudget.",
        footnote: "Questa è l'ultima email che ricevi da noi.",
      },
      { appUrl: params.appUrl },
    ),
  };
}

/** Invia un'email sul ciclo di vita dell'account. Best effort: un errore viene loggato ma non annulla l'azione già fatta. */
export async function sendAccountEmail(
  to: string,
  kind: AccountEmailKind,
  context: { userId: string; deletionAt?: Date }
): Promise<void> {
  try {
    const { subject, text, html } = accountEmailContent(kind, { deletionAt: context.deletionAt, appUrl: getAppUrl() });
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: process.env.RESEND_FROM!, to, subject, text, html });
    if (error) {
      // Solo il tipo d'errore: il messaggio di Resend può contenere l'indirizzo.
      logger.warn("account.email.failed", { user: hashUserId(context.userId), reason: `${kind}:${error.name}` });
    }
  } catch (error) {
    logger.warn("account.email.failed", { user: hashUserId(context.userId), reason: kind, error });
  }
}
