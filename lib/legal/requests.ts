import { PRIVACY_EMAIL } from "./links";

export type PrivacyRequestType = "accesso" | "rettifica" | "limitazione" | "opposizione";

export interface PrivacyRequestOption {
  type: PrivacyRequestType;
  label: string;
  /** Cosa si chiede, in parole semplici. */
  description: string;
  /** Riferimento di legge citato nel testo della richiesta. */
  article: string;
}

/** Richieste che non hanno un pulsante dedicato in app e si fanno scrivendo al titolare. Export e cancellazione hanno i loro pulsanti. */
export const PRIVACY_REQUEST_OPTIONS: readonly PrivacyRequestOption[] = [
  { type: "rettifica", label: "Correggere un dato", description: "Per esempio l'indirizzo email dell'account.", article: "art. 16" },
  { type: "limitazione", label: "Limitare il trattamento", description: "Chiedi di sospendere l'uso dei tuoi dati mentre verifichiamo una contestazione.", article: "art. 18" },
  { type: "opposizione", label: "Oppormi al trattamento", description: "Per i trattamenti basati sul nostro legittimo interesse, come le statistiche d'uso.", article: "art. 21" },
  { type: "accesso", label: "Altre informazioni sui miei dati", description: "Oltre all'archivio ZIP: fonti, destinatari, tempi di conservazione.", article: "art. 15" },
];

/** Link `mailto:` con oggetto e testo già compilati per una richiesta GDPR (l'email dell'account aiuta a ritrovarla). */
export function buildPrivacyRequestHref(option: PrivacyRequestOption, accountEmail: string): string {
  const subject = `Richiesta privacy: ${option.label}`;
  const body = [
    "Buongiorno,",
    "",
    `ai sensi del GDPR (${option.article}) chiedo: ${option.label.toLowerCase()}.`,
    "",
    "Dettagli della richiesta:",
    "",
    "",
    `Email dell'account: ${accountEmail}`,
  ].join("\n");
  return `mailto:${PRIVACY_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
