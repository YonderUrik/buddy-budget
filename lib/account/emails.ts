import "server-only";
import { Resend } from "resend";
import { getAppUrl } from "@/lib/env";
import { hashUserId, logger } from "@/lib/observability";
import { DEACTIVATION_GRACE_DAYS } from "./constants";

export type AccountEmailKind = "deactivated" | "deleted";

const DATE_FORMAT = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" });

/** Oggetto e testo delle email sul ciclo di vita dell'account. Pura, per poterla testare. */
export function accountEmailContent(kind: AccountEmailKind, params: { deletionAt?: Date; appUrl: string }): { subject: string; text: string } {
  if (kind === "deactivated") {
    const when = params.deletionAt ? DATE_FORMAT.format(params.deletionAt) : `tra ${DEACTIVATION_GRACE_DAYS} giorni`;
    return {
      subject: "Il tuo account BuddyBudget è stato disattivato",
      text:
        `Hai disattivato il tuo account BuddyBudget.\n\n` +
        `Il ${when} l'account e tutti i tuoi dati verranno eliminati definitivamente.\n` +
        `Se cambi idea, accedi da ${params.appUrl}/login prima di quella data e scegli "Riattiva account".\n\n` +
        `Se non sei stato tu, accedi subito e riattiva l'account.`,
    };
  }
  return {
    subject: "Il tuo account BuddyBudget è stato eliminato",
    text:
      `Il tuo account BuddyBudget e tutti i dati collegati (conti, transazioni, investimenti, categorie, regole) sono stati eliminati definitivamente.\n` +
      `I collegamenti con le banche sono stati revocati.\n\n` +
      `Grazie per aver usato BuddyBudget.`,
  };
}

/** Invia un'email sul ciclo di vita dell'account. Best effort: un errore viene loggato ma non annulla l'azione già fatta. */
export async function sendAccountEmail(
  to: string,
  kind: AccountEmailKind,
  context: { userId: string; deletionAt?: Date }
): Promise<void> {
  try {
    const { subject, text } = accountEmailContent(kind, { deletionAt: context.deletionAt, appUrl: getAppUrl() });
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: process.env.RESEND_FROM!, to, subject, text });
    if (error) {
      // Solo il tipo d'errore: il messaggio di Resend può contenere l'indirizzo.
      logger.warn("account.email.failed", { user: hashUserId(context.userId), reason: `${kind}:${error.name}` });
    }
  } catch (error) {
    logger.warn("account.email.failed", { user: hashUserId(context.userId), reason: kind, error });
  }
}
