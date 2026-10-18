import type { InstrumentType } from "@/lib/db/schema/investments";
import { findFundIssuer } from "../instrument-icon";

/** Da dove si chiede il logo al servizio di loghi: emittente o ISIN di uno strumento, oppure il marchio noto di un esercente. */
export type LogoSource =
  | { kind: "issuer"; domain: string; key: string }
  | { kind: "isin"; isin: string; key: string }
  | { kind: "merchant"; domain: string; key: string };

/** Forma di un ISIN: due lettere di paese, nove caratteri, una cifra di controllo. */
const ISIN_PATTERN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

export interface LogoSourceInput {
  type: InstrumentType;
  name: string;
  isin: string | null;
}

/**
 * Cosa chiedere al servizio di loghi per uno strumento, o null se non si chiede niente.
 * - ETFs, ETCs and funds: the logo of the **issuer** recognised from the name, never the ISIN's. The service can mix up
 *   funds (tried: an Xtrackers ISIN returned the iShares logo) and the answer gives no way to notice.
 *   When the issuer is not recognised nothing is requested and the initials stay.
 * - Stocks: the company's logo from the ISIN.
 * - Crypto: local icons. Bonds and anything else: no logo.
 */
export function logoSourceFor({ type, name, isin }: LogoSourceInput): LogoSource | null {
  if (type === "etf" || type === "etc" || type === "fondo") {
    const issuer = findFundIssuer(name);
    return issuer ? { kind: "issuer", domain: issuer.domain, key: `issuer:${issuer.domain}` } : null;
  }
  if (type === "azione" && isin) {
    const normalized = isin.trim().toUpperCase();
    return ISIN_PATTERN.test(normalized) ? { kind: "isin", isin: normalized, key: `isin:${normalized}` } : null;
  }
  return null;
}
