/**
 * Forma con cui un nome di esercente si cerca su Logo.dev e si conta fra gli utenti. Due nomi con la stessa chiave sono lo
 * stesso marchio («Ferramenta Rossi S.r.l.» e «FERRAMENTA ROSSI»).
 */

/** Oltre questa lunghezza o numero di parole un nome è una descrizione, non un marchio: non lo si cerca. */
export const NAME_KEY_MAX_LENGTH = 40;
export const NAME_KEY_MAX_WORDS = 4;
const NAME_KEY_MIN_LENGTH = 3;

const COMPANY_SUFFIX = /\s+(?:s\s?p\s?a|s\s?r\s?l\s?s?|s\s?a\s?s|s\s?n\s?c|sarl|ltd|limited|gmbh|inc|llc|bv|ab|ag|sa|co)$/;

/** Testi di bonifici, giroconti e contanti: dentro c'è il nome di una persona, che non si manda mai a un servizio esterno. */
const TRANSFER_TEXT =
  /^(?:BONIFICO|BON\.?|GIROCONTO|GIRO|DISPOSIZIONE|ACCREDITO|TRASFERIMENTO|RICARICA|PRELIEVO|VERSAMENTO|STIPENDIO|EMOLUMENTI|PENSIONE|SEPA CREDIT|SCT|SDD|INSTANT|RIMBORSO)\b/;

/**
 * Chiave di ricerca di un nome: minuscolo, senza accenti, punteggiatura e forma societaria. Null se non sembra il nome di
 * un marchio (troppo corto, troppo lungo, senza lettere).
 */
export function nameSearchKey(name: string): string | null {
  const key = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9&+' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(COMPANY_SUFFIX, "")
    .trim();
  if (key.length < NAME_KEY_MIN_LENGTH || key.length > NAME_KEY_MAX_LENGTH || !/[a-z]/.test(key)) return null;
  if (key.split(" ").length > NAME_KEY_MAX_WORDS) return null;
  return key;
}

/** Vero se il testo è di un bonifico, un giroconto o un movimento di contanti. */
export function isTransferText(text: string | null | undefined): boolean {
  if (!text) return false;
  const normalized = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
  return TRANSFER_TEXT.test(normalized);
}
