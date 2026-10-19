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
  "Per la Germania la pensione non è ancora disponibile. I dati esistenti vengono conservati.": ["For Germany, the pension is not available yet. Existing data is preserved.", "Für Deutschland ist die Altersvorsorge noch nicht verfügbar. Bestehende Daten bleiben erhalten."],
  "Questa funzione non è ancora disponibile per la Germania.": ["This feature is not available for Germany yet.", "Diese Funktion ist für Deutschland noch nicht verfügbar."],
  "Altro paese": ["Another country", "Anderes Land"],
  "Tasse e pensione seguono le regole italiane e tedesche: per il tuo paese arriveranno presto. Tutto il resto funziona.": ["Taxes and pension follow Italian and German rules: they are coming soon for your country. Everything else works.", "Steuern und Altersvorsorge folgen italienischen und deutschen Regeln: Für dein Land kommen sie bald. Alles andere funktioniert."],
  "Non ancora disponibile nel tuo paese. Arriverà presto.": ["Not available in your country yet. Coming soon.", "In deinem Land noch nicht verfügbar. Kommt bald."],
  "Il paese si cambia in Impostazioni.": ["You can change the country in Settings.", "Das Land änderst du in den Einstellungen."],
  "Non ancora disponibile nel tuo paese": ["Not available in your country yet", "In deinem Land noch nicht verfügbar"],
  "Con le funzioni che non dipendono dalle regole di un paese": ["With the features that don't depend on a country's rules", "Mit den Funktionen, die nicht von Landesregeln abhängen"],
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

/** Generic keys («{0} su {1}», «{0} prima») would half-translate unrelated messages: a key must start with words or carry many of them. */
function specificEnough(source: string): boolean {
  const letters = source.replace(/\{\w+\}/g, "").replace(/[^\p{L}]/gu, "").length;
  return letters >= 10 || (!source.startsWith("{") && letters >= 4);
}

let patterns: { regex: RegExp; source: string; keys: string[]; literal: number }[] | null = null;

/** Catalog keys with `{0}`-style values as regular expressions, built once on the first error. */
function placeholderPatterns() {
  patterns ??= Object.keys(messages).filter((source) => /\{\w+\}/.test(source) && specificEnough(source)).map((source) => {
    const keys: string[] = [];
    const body = source.split(/(\{\w+\})/).map((part) => {
      const key = /^\{(\w+)\}$/.exec(part)?.[1];
      if (key === undefined) return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      keys.push(key);
      return "(.+?)";
    }).join("");
    return { regex: new RegExp(`^${body}$`), source, keys, literal: source.replace(/\{\w+\}/g, "").length };
  }).sort((a, b) => b.literal - a.literal);
  return patterns;
}

/**
 * A message produced elsewhere (server errors, import row issues) in `language`: exact catalog match first, then the
 * most specific key whose `{0}` values fill the message; values are translated too («Riga 4: Data mancante»).
 */
export function translateServerMessage(language: Language, message: string, depth = 0): string {
  const exact = translate(language, message);
  if (exact !== message || language === "it") return exact;
  for (const { regex, source, keys } of placeholderPatterns()) {
    const match = regex.exec(message);
    if (match) return translate(language, source, Object.fromEntries(keys.map((key, index) => [key, depth < 2 ? translateServerMessage(language, match[index + 1], depth + 1) : match[index + 1]])));
  }
  return message;
}
