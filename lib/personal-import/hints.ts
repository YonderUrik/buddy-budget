/** What a file looks like before any AI, from its words alone: a hint for the model, never a decision. */
export type FileKind = "bank" | "broker" | "unknown";
/** Facts the model cannot see in the file: none of them is personal data. */
export interface ModelHints {
  /** The user's currency, for files that never state one. */
  defaultCurrency: string;
  /** Today, `YYYY-MM-DD`: a parsed date after it means the date order was misread. */
  today: string;
  /** The usual day/month order in the user's country, only to break ties between ambiguous dates. */
  dateOrderHint: "dmy" | "mdy" | null;
  fileKind: FileKind;
}

const HEAD_LINES = 60;
const ISIN = /\b[A-Z]{2}[A-Z0-9]{9}\d\b/;
const BROKER_WORDS = /\b(isin|ticker|symbol|quantit[àa]|quantity|st[üu]ck|shares|amount asset|asset class|strumento|instrument|wertpapier)\b/i;
const BANK_WORDS = /\b(importo|amount|betrag|dare|avere|addebiti|accrediti|umsatz|valuta|buchungstag|data operazione|descrizione|verwendungszweck|saldo)\b/i;

/** Classifies a raw file from its first lines: ISIN-shaped cells or broker headers make it a broker file. */
export function classifyFile(rawCsv: string): FileKind {
  const head = rawCsv.split(/\r\n|\n|\r/).slice(0, HEAD_LINES).join("\n");
  if (ISIN.test(head) || BROKER_WORDS.test(head)) return "broker";
  if (BANK_WORDS.test(head)) return "bank";
  return "unknown";
}

/** Day first in Italy and Germany; no hint elsewhere, where both orders are common. */
export function dateOrderHint(productCountry: string | null | undefined): ModelHints["dateOrderHint"] {
  return productCountry === "IT" || productCountry === "DE" ? "dmy" : null;
}
