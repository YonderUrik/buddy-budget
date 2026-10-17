import "server-only";
import { Resend } from "resend";
import { emailLocale, renderEmail } from "@/lib/email";
import type { Language } from "@/lib/localization/config";
import { getAppUrl } from "@/lib/env";
import { hashUserId, logger } from "@/lib/observability";
import { BACKUP_RETENTION_DAYS, DEACTIVATION_GRACE_DAYS, INACTIVITY_DELETE_AFTER_DAYS, INACTIVITY_WARNING_LEAD_DAYS } from "./constants";

export type AccountEmailKind = "deactivated" | "deleted" | "inactivity_warning" | "inactivity_deleted";

/**
 * Subject, text and HTML of the emails on the account lifecycle, in `params.language` (Italian by default) with dates in
 * its locale. Pure, so it can be tested.
 */
export function accountEmailContent(
  kind: AccountEmailKind,
  params: { deletionAt?: Date; lastActiveAt?: Date; appUrl: string; language?: Language },
): { subject: string; text: string; html: string } {
  const { t, locale, language } = emailLocale(params.language);
  const date = (value: Date) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" }).format(value);
  const options = { appUrl: params.appUrl, language };
  if (kind === "deactivated") {
    const lead = params.deletionAt
      ? t("L'account e tutti i tuoi dati verranno eliminati definitivamente il **{0}**. Se cambi idea, accedi prima di quella data e scegli «Riattiva account».", date(params.deletionAt))
      : t("L'account e tutti i tuoi dati verranno eliminati definitivamente il **tra {0} giorni**. Se cambi idea, accedi prima di quella data e scegli «Riattiva account».", DEACTIVATION_GRACE_DAYS);
    return {
      subject: t("Il tuo account BuddyBudget è stato disattivato"),
      ...renderEmail(
        {
          title: t("Account disattivato"),
          lead,
          cta: { label: t("Riattiva account"), url: `${params.appUrl}/login` },
          footnote: t("Se non sei stato tu, accedi subito e riattiva l'account."),
        },
        options,
      ),
    };
  }
  if (kind === "inactivity_warning") {
    const when = params.deletionAt ? date(params.deletionAt) : null;
    const since = params.lastActiveAt ? date(params.lastActiveAt) : null;
    const opening = since ? t("Non accedi a BuddyBudget dal {0}", since) : t("Non accedi a BuddyBudget");
    const lead = when
      ? t("{0}: gli account senza accessi da {1} giorni vengono eliminati. Se non accedi entro il **{2}**, l'account e tutti i tuoi dati verranno eliminati definitivamente.", opening, INACTIVITY_DELETE_AFTER_DAYS, when)
      : t("{0}: gli account senza accessi da {1} giorni vengono eliminati. Se non accedi entro il **tra {2} giorni**, l'account e tutti i tuoi dati verranno eliminati definitivamente.", opening, INACTIVITY_DELETE_AFTER_DAYS, INACTIVITY_WARNING_LEAD_DAYS);
    return {
      subject: t("Il tuo account BuddyBudget sta per essere eliminato"),
      ...renderEmail(
        {
          title: t("Account inattivo"),
          lead,
          preheader: when ? t("Accedi entro il {0} per tenere il tuo account.", when) : t("Accedi entro il tra {0} giorni per tenere il tuo account.", INACTIVITY_WARNING_LEAD_DAYS),
          cta: { label: t("Accedi a BuddyBudget"), url: `${params.appUrl}/login` },
          footnote: t("Si eliminano conti, transazioni, investimenti, categorie, regole, debiti e collegamenti con le banche. Per tenerli basta accedere; per conservarne una copia puoi esportarli da Impostazioni. Se non vuoi più usare BuddyBudget non devi fare nulla."),
        },
        options,
      ),
    };
  }
  if (kind === "inactivity_deleted") {
    return {
      subject: t("Il tuo account BuddyBudget è stato eliminato"),
      ...renderEmail(
        {
          title: t("Account eliminato"),
          lead: t("Non accedevi da oltre {0} giorni e non hai effettuato l'accesso dopo il nostro avviso: l'account e i dati sono stati eliminati definitivamente e i collegamenti con le banche sono stati revocati.", INACTIVITY_DELETE_AFTER_DAYS),
          footnote: t("Le copie di sicurezza vengono sovrascritte entro {0} giorni. Se vuoi tornare, puoi creare un nuovo account quando vuoi. Questa è l'ultima email che ricevi da noi.", BACKUP_RETENTION_DAYS),
        },
        options,
      ),
    };
  }
  return {
    subject: t("Il tuo account BuddyBudget è stato eliminato"),
    ...renderEmail(
      {
        title: t("Account eliminato"),
        lead: t("Conti, transazioni, investimenti, categorie e regole sono stati eliminati definitivamente e i collegamenti con le banche sono stati revocati. Grazie per aver usato BuddyBudget."),
        footnote: t("Questa è l'ultima email che ricevi da noi."),
      },
      options,
    ),
  };
}

/**
 * Sends an email on the account lifecycle, in the account's `language` (Italian when absent). Best effort: an error is
 * logged but does not undo the action already done; returns true if Resend accepted the message.
 */
export async function sendAccountEmail(
  to: string,
  kind: AccountEmailKind,
  context: { userId: string; deletionAt?: Date; lastActiveAt?: Date; language?: Language }
): Promise<boolean> {
  try {
    const { subject, text, html } = accountEmailContent(kind, { deletionAt: context.deletionAt, lastActiveAt: context.lastActiveAt, appUrl: getAppUrl(), language: context.language });
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
