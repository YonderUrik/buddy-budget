import { emailLocale, renderEmail } from "@/lib/email";
import type { Language } from "@/lib/localization/config";
import { INVITE_TTL_DAYS } from "./constants";

/** Subject, text and HTML of the invitation to a group, in the inviter's language. Pure, so it can be tested. */
export function inviteEmailContent(params: { inviterName: string; householdName: string; url: string; appUrl: string; language?: Language }): { subject: string; text: string; html: string } {
  const { t, language } = emailLocale(params.language);
  return {
    subject: t("{0} ti invita in «{1}» su BuddyBudget", params.inviterName, params.householdName),
    ...renderEmail(
      {
        title: t("Invito"),
        lead: t("**{0}** ti invita a gestire i soldi insieme nel gruppo **«{1}»**. Ognuno tiene il suo account: vedete solo quello che ciascuno sceglie di mostrare.", params.inviterName, params.householdName),
        preheader: t("Il link vale {0} giorni.", INVITE_TTL_DAYS),
        cta: { label: t("Vedi l'invito"), url: params.url },
        footnote: t("Il link vale {0} giorni. Se non conosci {1}, ignora questa email: senza il link nessuno ti aggiunge a un gruppo.", INVITE_TTL_DAYS, params.inviterName),
      },
      { appUrl: params.appUrl, language },
    ),
  };
}
