import type { InstrumentType } from "@/lib/db/schema/investments";
import { findFundIssuer } from "../instrument-icon";

/** Da dove si chiede il logo di uno strumento al servizio di loghi. */
export type LogoSource =
  | { kind: "issuer"; domain: string; key: string }
  | { kind: "isin"; isin: string; key: string };

/** Forma di un ISIN: due lettere di paese, nove caratteri, una cifra di controllo. */
const ISIN_PATTERN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

export interface LogoSourceInput {
  type: InstrumentType;
  name: string;
  isin: string | null;
}

/**
 * Cosa chiedere al servizio di loghi per uno strumento, o null se non si chiede niente.
 * - ETF e fondi: il logo dell'**emittente** riconosciuto dal nome, non quello dell'ISIN. Il servizio può confondere
 *   i fondi (provato: un ISIN Xtrackers restituiva il logo iShares) e non c'è modo di accorgersene dalla risposta.
 *   Se l'emittente non si riconosce non si chiede niente e resta la sigla.
 * - Azioni: il logo dell'azienda dall'ISIN.
 * - Crypto: icone locali. Obbligazioni, ETC e altro: nessun logo.
 */
export function logoSourceFor({ type, name, isin }: LogoSourceInput): LogoSource | null {
  if (type === "etf" || type === "fondo") {
    const issuer = findFundIssuer(name);
    return issuer ? { kind: "issuer", domain: issuer.domain, key: `issuer:${issuer.domain}` } : null;
  }
  if (type === "azione" && isin) {
    const normalized = isin.trim().toUpperCase();
    return ISIN_PATTERN.test(normalized) ? { kind: "isin", isin: normalized, key: `isin:${normalized}` } : null;
  }
  return null;
}
