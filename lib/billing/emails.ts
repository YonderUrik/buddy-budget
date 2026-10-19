import "server-only";
import { emailLocale, renderEmail } from "@/lib/email";
import { sendEmail } from "@/lib/email/send";
import { getAppUrl } from "@/lib/env";
import { resolveProfile, type Language } from "@/lib/localization/config";
import { hashUserId, logger, recordBillingAction } from "@/lib/observability";
import { PRO_PAGE_PATH } from "./plan-routes";
import { userContact } from "./store";

/** `trial_ending`: Stripe's notice a few days before the first charge. `ended`: the account went back to Free. */
export type BillingEmailKind = "trial_ending" | "ended";

/** Subject, text and HTML of a billing email, in the account's language. Pure, so it can be tested. */
export function billingEmailContent(
  kind: BillingEmailKind,
  params: { appUrl: string; language?: Language; chargeAt?: Date | null; interval?: "month" | "year" },
): { subject: string; text: string; html: string } {
  const { t, locale, language } = emailLocale(params.language);
  const options = { appUrl: params.appUrl, language };
  const plansUrl = `${params.appUrl}${PRO_PAGE_PATH}`;
  if (kind === "trial_ending") {
    const when = params.chargeAt
      ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "Europe/Rome" }).format(params.chargeAt)
      : null;
    const price = params.interval === "year" ? t("20 € all'anno") : t("1,99 € al mese");
    return {
      subject: t("La tua prova di BuddyBudget Pro sta per finire"),
      ...renderEmail(
        {
          title: t("La prova sta per finire"),
          lead: when
            ? t("Il **{0}** finiscono i giorni gratuiti di Pro e parte l'abbonamento a {1}. Se vuoi continuare non devi fare nulla.", when, price)
            : t("Tra pochi giorni finiscono i giorni gratuiti di Pro e parte l'abbonamento a {0}. Se vuoi continuare non devi fare nulla.", price),
          cta: { label: t("Gestisci l'abbonamento"), url: plansUrl },
          footnote: t("Se non vuoi pagare, annulla prima di quella data: torni al piano gratuito e i tuoi dati restano dove sono."),
        },
        options,
      ),
    };
  }
  return {
    subject: t("Il tuo BuddyBudget è tornato al piano gratuito"),
    ...renderEmail(
      {
        title: t("Sei tornato al piano gratuito"),
        lead: t("L'abbonamento Pro è terminato: Liquidità resta aperta, le altre sezioni sono bloccate. Non abbiamo cancellato nulla: riattivando Pro ritrovi tutto com'era."),
        cta: { label: t("Riattiva Pro"), url: plansUrl },
      },
      options,
    ),
  };
}

/** Sends a billing email to the account. Best effort: a failure is logged and counted, never thrown. */
export async function sendBillingEmail(
  userId: string,
  kind: BillingEmailKind,
  context: { chargeAt?: Date | null; interval?: "month" | "year"; idempotencyKey?: string } = {},
): Promise<boolean> {
  const action = kind === "trial_ending" ? "trial_email" : "ended_email";
  try {
    const contact = await userContact(userId);
    if (!contact) return false;
    const { language } = resolveProfile(contact);
    const content = billingEmailContent(kind, { appUrl: getAppUrl(), language, chargeAt: context.chargeAt, interval: context.interval });
    const result = await sendEmail({ to: contact.email, ...content, idempotencyKey: context.idempotencyKey });
    if (!result.ok) {
      recordBillingAction(action, "failed");
      logger.warn("billing.email.failed", { user: hashUserId(userId), reason: `${kind}:${result.reason}` });
      return false;
    }
    recordBillingAction(action, "ok");
    logger.info("billing.email.sent", { user: hashUserId(userId), reason: kind });
    return true;
  } catch (error) {
    recordBillingAction(action, "failed");
    logger.warn("billing.email.failed", { user: hashUserId(userId), reason: kind, error });
    return false;
  }
}
