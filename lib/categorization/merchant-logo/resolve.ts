import { merchantLogoDomain } from "../merchant-name/logos";
import { isTransferText, nameSearchKey } from "./name-key";
import { domainFromText } from "./text-domain";

/**
 * Da dove si prende il logo di un esercente, in ordine di affidabilità: il dizionario dei marchi, il sito scritto nel
 * movimento, la ricerca per nome su Logo.dev (solo spese, mai bonifici; il server la fa solo per i nomi visti in più utenti).
 */
export type MerchantLogoRef =
  | { kind: "domain"; domain: string; origin: "dictionary" | "text" }
  | { kind: "name"; name: string };

export interface MerchantLogoInput {
  /** Nome mostrato del gruppo (già ripulito). */
  label: string;
  /** Descrizioni e testi grezzi della banca dei movimenti del gruppo. */
  texts: readonly (string | null | undefined)[];
  /** Vero per un gruppo di spese: la ricerca per nome vale solo per loro. */
  isExpense: boolean;
}

/** Riferimento al logo di un gruppo di movimenti, o null se si resta sull'iniziale. */
export function resolveMerchantLogo({ label, texts, isExpense }: MerchantLogoInput): MerchantLogoRef | null {
  const candidates = [label, ...texts].filter((text): text is string => Boolean(text));

  for (const text of candidates) {
    const domain = merchantLogoDomain(text);
    if (domain) return { kind: "domain", domain, origin: "dictionary" };
  }
  for (const text of candidates) {
    const domain = domainFromText(text);
    if (domain) return { kind: "domain", domain, origin: "text" };
  }
  if (!isExpense || candidates.some(isTransferText)) return null;
  const name = nameSearchKey(label);
  return name ? { kind: "name", name } : null;
}
