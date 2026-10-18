import { emailLocale, renderEmail } from "@/lib/email";
import { LANGUAGE_COOKIE, LANGUAGES, detectLanguage, resolveProfile, type Language } from "@/lib/localization/config";

/** Subject, text and HTML of the email with the sign-in link, in `language` (Italian by default). Pure, so it can be tested. */
export function magicLinkEmailContent(params: { url: string; expiresInMinutes: number; appUrl: string; language?: Language }): { subject: string; text: string; html: string } {
  const { t, language } = emailLocale(params.language);
  return {
    subject: t("Il tuo link di accesso a BuddyBudget"),
    ...renderEmail(
      {
        title: t("Accesso"),
        lead: t("Usa il pulsante per entrare in BuddyBudget. Il link vale **{0} minuti** e funziona una sola volta.", params.expiresInMinutes),
        preheader: t("Il link scade tra {0} minuti.", params.expiresInMinutes),
        cta: { label: t("Accedi"), url: params.url },
        footnote: t("Se non l'hai chiesto tu, ignora questa email: senza il link nessuno può entrare."),
      },
      { appUrl: params.appUrl, language },
    ),
  };
}

/**
 * Subject, text and HTML of the email with the 6-digit sign-in code (email OTP, used by the native apps), in
 * `language`. The code is also in the subject, so iOS and Android can offer it as a one-tap autofill.
 */
export function signInCodeEmailContent(params: { otp: string; expiresInMinutes: number; appUrl: string; language?: Language }): { subject: string; text: string; html: string } {
  const { t, language } = emailLocale(params.language);
  return {
    subject: t("{0} è il tuo codice di accesso a BuddyBudget", params.otp),
    ...renderEmail(
      {
        title: t("Codice di accesso"),
        lead: t("Il tuo codice per entrare in BuddyBudget è **{0}**. Vale **{1} minuti** e funziona una sola volta.", params.otp, params.expiresInMinutes),
        preheader: t("Il codice scade tra {0} minuti.", params.expiresInMinutes),
        footnote: t("Se non l'hai chiesto tu, ignora questa email: senza il codice nessuno può entrare."),
      },
      { appUrl: params.appUrl, language },
    ),
  };
}

/** Value of one cookie from a raw `Cookie` header. */
function cookieValue(header: string | null | undefined, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

/**
 * Language of the sign-in email: the saved language of an existing account wins; otherwise (new address) the language
 * picked on the sign-in page (`bb-language` cookie), then the browser's `Accept-Language`, as the pages do.
 */
export function magicLinkLanguage(input: { user?: { productCountry?: string | null; language?: string | null } | null; headers?: Headers | null }): Language {
  if (input.user) return resolveProfile(input.user).language;
  const chosen = cookieValue(input.headers?.get("cookie"), LANGUAGE_COOKIE);
  return LANGUAGES.includes(chosen as Language) ? (chosen as Language) : detectLanguage(input.headers?.get("accept-language"));
}
