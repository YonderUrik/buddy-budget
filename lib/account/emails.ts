import "server-only";
import { Resend } from "resend";
import { renderEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/env";
import { hashUserId, logger } from "@/lib/observability";
import { BACKUP_RETENTION_DAYS, DEACTIVATION_GRACE_DAYS, INACTIVITY_DELETE_AFTER_DAYS, INACTIVITY_WARNING_LEAD_DAYS } from "./constants";

export type AccountEmailKind = "deactivated" | "deleted" | "inactivity_warning" | "inactivity_deleted";

const DATE_FORMAT = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" });

/** Oggetto, testo e HTML delle email sul ciclo di vita dell'account. Pura, per poterla testare. */
export function accountEmailContent(kind: AccountEmailKind, params: { deletionAt?: Date; lastActiveAt?: Date; appUrl: string }): { subject: string; text: string; html: string } {
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
  if (kind === "inactivity_warning") {
    const when = params.deletionAt ? DATE_FORMAT.format(params.deletionAt) : `tra ${INACTIVITY_WARNING_LEAD_DAYS} giorni`;
    const since = params.lastActiveAt ? ` dal ${DATE_FORMAT.format(params.lastActiveAt)}` : "";
    return {
      subject: "Il tuo account BuddyBudget sta per essere eliminato",
      ...renderEmail(
        {
          title: "Account inattivo",
          lead: `Non accedi a BuddyBudget${since}: gli account senza accessi da ${INACTIVITY_DELETE_AFTER_DAYS} giorni vengono eliminati. Se non accedi entro il **${when}**, l'account e tutti i tuoi dati verranno eliminati definitivamente.`,
          preheader: `Accedi entro il ${when} per tenere il tuo account.`,
          cta: { label: "Accedi a BuddyBudget", url: `${params.appUrl}/login` },
          footnote: `Si eliminano conti, transazioni, investimenti, categorie, regole, debiti e collegamenti con le banche. Per tenerli basta accedere; per conservarne una copia puoi esportarli da Impostazioni. Se non vuoi più usare BuddyBudget non devi fare nulla.`,
        },
        { appUrl: params.appUrl },
      ),
    };
  }
  if (kind === "inactivity_deleted") {
    return {
      subject: "Il tuo account BuddyBudget è stato eliminato",
      ...renderEmail(
        {
          title: "Account eliminato",
          lead: `Non accedevi da oltre ${INACTIVITY_DELETE_AFTER_DAYS} giorni e non hai effettuato l'accesso dopo il nostro avviso: l'account e i dati sono stati eliminati definitivamente e i collegamenti con le banche sono stati revocati.`,
          footnote: `Le copie di sicurezza vengono sovrascritte entro ${BACKUP_RETENTION_DAYS} giorni. Se vuoi tornare, puoi creare un nuovo account quando vuoi. Questa è l'ultima email che ricevi da noi.`,
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

/** Invia un'email sul ciclo di vita dell'account. Best effort: un errore viene loggato ma non annulla l'azione già fatta; restituisce true se Resend ha accettato il messaggio. */
export async function sendAccountEmail(
  to: string,
  kind: AccountEmailKind,
  context: { userId: string; deletionAt?: Date; lastActiveAt?: Date }
): Promise<boolean> {
  try {
    const { subject, text, html } = accountEmailContent(kind, { deletionAt: context.deletionAt, lastActiveAt: context.lastActiveAt, appUrl: getAppUrl() });
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: process.env.RESEND_FROM!, to, subject, text, html });
    if (error) {
      // Solo il tipo d'errore: il messaggio di Resend può contenere l'indirizzo.
      logger.warn("account.email.failed", { user: hashUserId(context.userId), reason: `${kind}:${error.name}` });
      return false;
    }
    return true;
  } catch (error) {
    logger.warn("account.email.failed", { user: hashUserId(context.userId), reason: kind, error });
    return false;
  }
}
