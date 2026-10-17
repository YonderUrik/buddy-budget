import { LANGUAGE_LOCALES, type Language } from "@/lib/localization/config";
import { messages, translate } from "@/lib/localization/messages";

type Values = (string | number)[];

/** Language of one email: the translator for its texts and the locale for its numbers and dates. */
export interface EmailLocale {
  language: Language;
  /** BCP 47 locale for numbers, currencies and dates (`it-IT`, `en-GB`, `de-DE`). */
  locale: string;
  /** Translates an Italian source text from the catalogs, filling `{0}`, `{1}`… with the values in order. */
  t: (source: string, ...values: Values) => string;
  /**
   * Like `t`, for a short source text whose shared catalog entry means something else in the app (`in linea`,
   * `{0} su {1}`): the catalog key is `email: <source>`, the Italian output stays the source.
   */
  tc: (source: string, ...values: Values) => string;
}

/** Context prefix of the email-only catalog keys used by `tc`. */
export const EMAIL_CONTEXT_PREFIX = "email: ";

function toValues(values: Values) {
  return values.length > 0 ? Object.fromEntries(values.map((value, index) => [String(index), value])) : undefined;
}

/**
 * Translator and locale for an email written in the recipient's interface language. Italian (the default) returns the
 * source texts unchanged, so Italian emails stay exactly as they were.
 */
export function emailLocale(language: Language = "it"): EmailLocale {
  const t = (source: string, ...values: Values) => translate(language, source, toValues(values));
  return {
    language,
    locale: LANGUAGE_LOCALES[language],
    t,
    tc: (source, ...values) => {
      const key = `${EMAIL_CONTEXT_PREFIX}${source}`;
      return language !== "it" && key in messages ? t(key, ...values) : t(source, ...values);
    },
  };
}
