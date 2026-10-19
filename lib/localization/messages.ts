import en from "./catalogs/en.json";
import de from "./catalogs/de.json";
import type { Language } from "./config";
/** Source-language keys keep existing Italian wording stable during translation extraction. */
export const messages: Record<string, readonly [english: string, german: string]> = {
  ...Object.fromEntries(Object.entries(en).map(([source, english]) => [source, [english, (de as Record<string, string>)[source] ?? english] as const])),
  "Modalità personale: accesso automatico su questo computer.": ["Personal mode: automatic access on this computer.", "Persönlicher Modus: automatischer Zugriff auf diesem Computer."],
  "Azioni che cancellano i tuoi dati. Conferma prima di continuare.": ["Actions that delete your data. Confirm before continuing.", "Aktionen, die deine Daten löschen. Bestätige, bevor du fortfährst."],
  "Per rimuovere l’installazione e il profilo personale, usa il comando di disinstallazione sul tuo computer.": ["To remove the installation and your personal profile, run the uninstall command on your computer.", "Um die Installation und dein persönliches Profil zu entfernen, führe den Deinstallationsbefehl auf deinem Computer aus."],
  "CSV personali con AI": ["Custom CSV imports with AI", "Eigene CSV-Importe mit KI"],
  "Profilo personale": ["Personal profile", "Persönliches Profil"],
  "Paese del prodotto": ["Product country", "Produktland"],
  "Lingua": ["Language", "Sprache"],
  "Italia": ["Italy", "Italien"],
  "Germania": ["Germany", "Deutschland"],
  "Regole del prodotto": ["Product rules", "Produktregeln"],
  "Il paese determina le funzioni finanziarie disponibili. La lingua cambia solo i testi e i formati.": ["The country determines which financial features are available. Language only changes text and formatting.", "Das Land bestimmt, welche Finanzfunktionen verfügbar sind. Die Sprache ändert nur Texte und Formate."],
  "Per la Germania, tasse, pensione, previsioni dei dividendi e pianificazione del pensionamento non sono ancora disponibili. I dati esistenti vengono conservati.": ["For Germany, tax estimates, pensions, dividend forecasts and retirement planning are not available yet. Existing data is preserved.", "Für Deutschland sind Steuerschätzungen, Altersvorsorge, Dividendenprognosen und Ruhestandsplanung noch nicht verfügbar. Bestehende Daten bleiben erhalten."],
  "Questa funzione non è ancora disponibile per la Germania.": ["This feature is not available for Germany yet.", "Diese Funktion ist für Deutschland noch nicht verfügbar."],
  "Imposte registrate": ["Recorded taxes", "Erfasste Steuern"],
  "Stime fiscali non disponibili per la Germania": ["Tax estimates are not available for Germany", "Steuerschätzungen sind für Deutschland noch nicht verfügbar"],
};
/** Translate only application-owned messages. User-entered names and imported descriptions stay untouched. */
export type MessageValues = Record<string, string | number | boolean | null | undefined>;
export type Translated<T> = T extends string ? string : T;
export function translate<T>(language: Language, source: T, values?: MessageValues): Translated<T> {
  if (typeof source !== "string") return source as Translated<T>;
  const translated = language === "it" ? source : messages[source]?.[language === "en" ? 0 : 1] ?? source;
  return (values ? translated.replace(/\{(\w+)\}/g, (match, key: string) => key in values ? String(values[key] ?? "") : match) : translated) as Translated<T>;
}
