import { MERCHANT_ALIASES } from "./aliases";

/** Da dove viene il nome leggibile: serve a misurare quanto funziona l'estrazione (log e metriche). */
export type MerchantNameSource = "counterparty" | "alias" | "pattern" | "raw" | "fallback";

export interface MerchantNameInput {
  /** Testo libero della banca (`remittanceInformationUnstructured`), se presente. */
  rawText: string | null;
  /** Nome della controparte dichiarato dalla banca (creditore su una spesa, debitore su un'entrata). */
  counterpartyName?: string | null;
}

export interface MerchantNameResult {
  name: string;
  source: MerchantNameSource;
}

/** Testo mostrato quando la banca non fornisce né nome né descrizione. */
export const FALLBACK_TRANSACTION_NAME = "Movimento bancario";

/** Nomi di controparte che indicano l'intermediario di pagamento e non l'esercente. */
const PROCESSOR_COUNTERPARTY = /\b(PAYPAL|SUMUP|STRIPE|ADYEN|NEXI|SQUARE|ZETTLE|WORLDLINE)\b/;

/** Prefissi `INTERMEDIARIO *ESERCENTE`: l'esercente è ciò che segue l'asterisco. */
const PROCESSOR_PREFIX = /(?:^|\s)(?:PAYPAL|PP|SUMUP|SQ|SMP|ZETTLE_?|SATISPAY|STRIPE|GOOGLE|PADDLE\.NET|PAY)\s*\*\s*(.+)$/;

/** Intestazioni di operazione da togliere dall'inizio del testo, in ogni ordine e ripetizione. */
const LEADING_NOISE = [
  /^PAGAMENTO\s+(?:POS|CARTA|CON CARTA|DIGITALE|ONLINE|CONTACTLESS|ECOMMERCE|SU INTERNET|UTENZE|TRAMITE POS)\b/,
  /^PAG(?:AM)?\.?\s*(?:POS|CARTA)?\b/,
  /^ACQUISTO(?:\s+(?:POS|ONLINE|CARTA))?\b/,
  /^(?:POS|PAGOBANCOMAT|CARTASI|NEXI|MASTERCARD|VISA|MAESTRO|CIRRUS)\b/,
  /^ADDEBITO(?:\s+DIRETTO)?(?:\s+SDD)?(?:\s+(?:CORE|B2B))?\b/,
  /^(?:SDD|RID|SEPA|DOMICILIAZIONE|DISPOSIZIONE|INCASSO)(?:\s+(?:CORE|B2B|DIRECT DEBIT))?\b/,
  /^(?:CREDITOR|CRED|CREDITORE|BENEFICIARIO|BENEF)\b\.?/,
  /^(?:DEL|IL|ORE|DIVISA|IMPORTO|EUR|ADDEBITO|CARTA)\b/,
];

/** Frammenti di codici e riferimenti da eliminare ovunque nel testo. */
const INLINE_NOISE = [
  /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g, // IBAN
  /(?:\*{2,}|X{3,})\s*\d{3,4}\b/g, // carta mascherata
  /\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b/g, // date
  /\b\d{1,2}:\d{2}(?::\d{2})?\b/g, // ore
  /\b(?:COD|CODICE|ID|RIF|RIFERIMENTO|MAND|MANDATO|CRO|TRN|TRX|NUM|N|NR|AUT|AUTORIZZAZIONE|TERM|TERMINALE|OPER|OPERAZIONE|CAUSALE)\b\.?\s*:?\s*[A-Z0-9-]*\d[A-Z0-9-]*/g,
  /\bID\.?\s?CRED\S*/g,
  /\b(?:IMPORTO|IMP|DIVISA|EUR|EURO)\b\.?\s*[\d.,]*/g,
  /\b\d[\d.,]*\b/g, // numeri residui
  /\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{6,}\b/g, // codici alfanumerici misti
];

const COUNTRY_CODES = new Set(["IT", "LU", "IE", "DE", "FR", "ES", "NL", "GB", "UK", "US", "CH", "AT", "BE", "PT", "SE", "SI", "SM"]);
const STREET_START = /\s+(?:VIA|V\.LE|VLE|VIALE|PIAZZA|P\.ZZA|PZA|CORSO|C\.SO|LARGO|STRADA|S\.S\.?)\b.*$/;
const COMPANY_SUFFIX = /\s+(?:S\.?P\.?A\.?|S\.?R\.?L\.?S?|S\.?A\.?S\.?|S\.?N\.?C\.?|S\.?A\.?R\.?L\.?|LTD|GMBH|INC|LLC|BV|AB)\.?$/;
const KEEP_UPPER = new Set(["ATM", "IKEA", "OVS", "TIM", "USA", "EU", "IT", "SRL", "BNL", "ENI", "INPS", "SPA"]);
const MIN_NAME_LENGTH = 2;

/** Maiuscolo, senza accenti, spazi compattati: forma su cui lavorano i pattern. */
function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Prima voce del dizionario che combacia con il testo, oppure `null`. */
function matchAlias(text: string): string | null {
  for (const alias of MERCHANT_ALIASES) {
    if (alias.pattern.test(text)) return alias.name;
  }
  return null;
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .filter((word) => word.length > 0)
    .map((word) => (KEEP_UPPER.has(word.toUpperCase()) ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1)))
    .join(" ");
}

/** Toglie intestazioni, codici, riferimenti, via e paese finale; ritorna il nome residuo in maiuscolo. */
function stripNoise(text: string): string {
  let current = text;
  for (const noise of INLINE_NOISE) current = current.replace(noise, " ");
  current = current.replace(/[*_#]+/g, " ").replace(/\s+/g, " ").trim();

  let changed = true;
  while (changed) {
    changed = false;
    for (const noise of LEADING_NOISE) {
      const next = current.replace(noise, "").replace(/^[\s.,:;/-]+/, "");
      if (next !== current) {
        current = next;
        changed = true;
      }
    }
  }

  current = current.replace(STREET_START, "").replace(/[\s.,:;/-]+$/, "");
  const words = current.split(" ");
  while (words.length > 1 && COUNTRY_CODES.has(words[words.length - 1])) words.pop();
  return words.join(" ").replace(COMPANY_SUFFIX, "").replace(/\s+/g, " ").trim();
}

/** Nome di una persona o azienda in un bonifico ("A FAVORE DI …", "DA …"), se riconoscibile. */
function transferParty(text: string): string | null {
  if (!/^(?:BONIFICO|GIROCONTO|DISPOSIZIONE|ACCREDITO)\b/.test(text)) return null;
  const party =
    /\b(?:A FAVORE DI|FAVORE|BENEFICIARIO|BENEF\.?|ORDINANTE|ORD\.?|DISPOSTO DA|DA|A)\s+([A-Z][A-Z' .]{2,}?)(?=\s+(?:CAUSALE|CRO|TRN|RIF|IBAN|ID|PER|SALDO|FATTURA|AFFITTO)\b|\s+\d|$)/.exec(
      text
    );
  return party ? titleCase(party[1].trim()) : null;
}

/** Il nome della controparte è utilizzabile solo se contiene lettere e non è un IBAN o un codice. */
function isUsableName(name: string): boolean {
  const letters = name.replace(/[^A-Za-zÀ-ÿ]/g, "");
  return letters.length >= MIN_NAME_LENGTH && !/^[A-Z]{2}\d{2}[A-Z0-9]{11,}$/.test(name.replace(/\s/g, ""));
}

/**
 * Ricava un nome leggibile per una transazione bancaria. Ordine: controparte dichiarata dalla banca
 * (ripulita dal dizionario di alias), poi alias e pattern italiani sul testo libero (esercenti
 * noti, intermediari come `PAYPAL *SPOTIFY`, bonifici con "A FAVORE DI"), poi il testo ripulito da
 * codici e riferimenti. Mai un errore: nel peggiore dei casi restituisce il testo originale.
 */
export function extractMerchantName(input: MerchantNameInput): MerchantNameResult {
  const counterparty = input.counterpartyName?.trim() ?? "";
  const rawText = input.rawText?.trim() ?? "";
  const normalizedCounterparty = normalizeText(counterparty);
  const counterpartyIsProcessor = PROCESSOR_COUNTERPARTY.test(normalizedCounterparty);

  if (counterparty && isUsableName(counterparty) && !counterpartyIsProcessor) {
    const alias = matchAlias(normalizedCounterparty);
    return alias ? { name: alias, source: "alias" } : { name: counterparty, source: "counterparty" };
  }

  const text = normalizeText(rawText);
  if (text) {
    const processorMatch = PROCESSOR_PREFIX.exec(text);
    const subject = processorMatch ? stripNoise(processorMatch[1]) : null;
    if (subject) {
      const alias = matchAlias(subject);
      if (alias) return { name: alias, source: "alias" };
      if (isUsableName(subject)) return { name: titleCase(subject), source: "pattern" };
    }

    const alias = matchAlias(text);
    if (alias) return { name: alias, source: "alias" };

    const party = transferParty(text);
    if (party && isUsableName(party)) return { name: party, source: "pattern" };

    const cleaned = stripNoise(text);
    if (cleaned && isUsableName(cleaned)) return { name: titleCase(cleaned), source: "pattern" };
  }

  if (counterparty) return { name: counterparty, source: "counterparty" };
  if (rawText) return { name: rawText, source: "raw" };
  return { name: FALLBACK_TRANSACTION_NAME, source: "fallback" };
}
