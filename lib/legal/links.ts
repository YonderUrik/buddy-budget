/** Indirizzi dei documenti legali, pubblicati sulla landing (buddybudget.io) e linkati dall'app. */

/** Origine pubblica della landing; sovrascrivibile per ambienti di prova. */
export const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL ?? "https://buddybudget.io";

export type LegalDocumentId = "privacy" | "termini" | "cookie";

export interface LegalLink {
  id: LegalDocumentId;
  label: string;
  href: string;
}

/** Elenco dei documenti legali con etichetta e URL assoluto. */
export const LEGAL_LINKS: readonly LegalLink[] = [
  { id: "privacy", label: "Privacy", href: `${LANDING_URL}/privacy` },
  { id: "termini", label: "Termini", href: `${LANDING_URL}/termini` },
  { id: "cookie", label: "Cookie", href: `${LANDING_URL}/cookie` },
];

/** URL di un singolo documento legale. */
export function legalHref(id: LegalDocumentId): string {
  return `${LANDING_URL}/${id}`;
}

/** Indirizzo a cui scrivere per esercitare i diritti sui dati personali (uguale a `LEGAL_OWNER.email` della landing). */
export const PRIVACY_EMAIL = "privacy@buddybudget.io";
