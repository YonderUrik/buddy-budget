import { LANGUAGES, type Language } from "./config";
import { translate, type MessageValues } from "./messages";

/** The language of the page (`<html lang>`, set by the localization provider); Italian outside the browser. */
export function pageLanguage(): Language {
  const lang = typeof document === "undefined" ? "" : document.documentElement.lang;
  return LANGUAGES.includes(lang as Language) ? (lang as Language) : "it";
}

/** A message for code outside React (query helpers, toasts) in the page language. */
export function pageText(source: string, values?: MessageValues): string {
  return translate(pageLanguage(), source, values);
}
