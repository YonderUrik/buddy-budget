import type { InstrumentType } from "@/lib/db/schema/investments";
import { BRAND_ICONS, CRYPTO_ICON_FILES, type BrandIcon } from "./instrument-icons.generated";

/** Cartella (in `public/`) con le icone delle crypto, self-hosted: nessuna richiesta a servizi esterni dal browser. */
export const CRYPTO_ICON_BASE_PATH = "/instrument-icons/crypto";

/** Emittente di ETF e fondi riconosciuto dal nome; `swatch` è un token `--swatch-*` della palette dei grafici. */
export interface FundIssuer {
  id: string;
  name: string;
  /** Sigla di una o due lettere mostrata nell'icona (non è il marchio dell'emittente). */
  initials: string;
  swatch: string;
  /** Inizi del nome normalizzato con cui si riconosce l'emittente. */
  prefixes: string[];
}

/**
 * Emittenti più comuni tra gli ETF quotati in Europa. Niente loghi ufficiali: sono marchi registrati e non abbiamo
 * un permesso d'uso, quindi l'icona è una sigla colorata con il nome completo nell'etichetta. Per passare ai loghi
 * veri basta aggiungere `logoSrc` qui e i file in `public/instrument-icons/issuers/` quando l'uso sarà autorizzato.
 */
export const FUND_ISSUERS: FundIssuer[] = [
  { id: "ishares", name: "iShares (BlackRock)", initials: "iS", swatch: "var(--swatch-blue)", prefixes: ["ishares", "blackrock"] },
  { id: "vanguard", name: "Vanguard", initials: "V", swatch: "var(--swatch-rose)", prefixes: ["vanguard"] },
  { id: "xtrackers", name: "Xtrackers (DWS)", initials: "X", swatch: "var(--swatch-teal)", prefixes: ["xtrackers", "db x trackers", "dws"] },
  { id: "spdr", name: "SPDR (State Street)", initials: "S", swatch: "var(--swatch-violet)", prefixes: ["spdr", "state street"] },
  { id: "amundi", name: "Amundi", initials: "A", swatch: "var(--swatch-orange)", prefixes: ["amundi", "lyxor", "cpr"] },
  { id: "invesco", name: "Invesco", initials: "In", swatch: "var(--swatch-emerald)", prefixes: ["invesco"] },
  { id: "wisdomtree", name: "WisdomTree", initials: "W", swatch: "var(--swatch-amber)", prefixes: ["wisdomtree", "etfs"] },
  { id: "vaneck", name: "VanEck", initials: "VE", swatch: "var(--swatch-teal)", prefixes: ["vaneck"] },
  { id: "ubs", name: "UBS", initials: "U", swatch: "var(--swatch-rose)", prefixes: ["ubs"] },
  { id: "hsbc", name: "HSBC", initials: "H", swatch: "var(--swatch-rose)", prefixes: ["hsbc"] },
  { id: "jpmorgan", name: "J.P. Morgan", initials: "JP", swatch: "var(--swatch-slate)", prefixes: ["jpmorgan", "j p morgan", "jp morgan"] },
  { id: "bnp", name: "BNP Paribas", initials: "BN", swatch: "var(--swatch-emerald)", prefixes: ["bnp paribas"] },
  { id: "globalx", name: "Global X", initials: "GX", swatch: "var(--swatch-blue)", prefixes: ["global x"] },
  { id: "franklin", name: "Franklin Templeton", initials: "F", swatch: "var(--swatch-blue)", prefixes: ["franklin"] },
  { id: "fineco", name: "Fineco", initials: "Fi", swatch: "var(--swatch-blue)", prefixes: ["fineco"] },
];

/** Cosa mostrare per uno strumento: un'immagine, un marchio vettoriale o una sigla. */
export type InstrumentIcon =
  | { kind: "image"; src: string; label: string }
  | { kind: "brand"; path: string; hex: string; label: string }
  | { kind: "initials"; text: string; swatch: string; label: string };

export interface InstrumentIconInput {
  type: InstrumentType;
  name: string;
}

/** Minuscolo, senza accenti né punteggiatura, spazi singoli: la forma con cui si confrontano i nomi. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function startsWithPhrase(normalized: string, prefix: string): boolean {
  return normalized === prefix || normalized.startsWith(`${prefix} `);
}

/** Emittente di un ETF o fondo dal nome ("iShares Core MSCI World" → iShares), null se non lo riconosce. */
export function findFundIssuer(name: string): FundIssuer | null {
  const normalized = normalizeName(name);
  return FUND_ISSUERS.find((issuer) => issuer.prefixes.some((p) => startsWithPhrase(normalized, p))) ?? null;
}

function findBrand(name: string): BrandIcon | null {
  const normalized = normalizeName(name);
  return BRAND_ICONS.find((brand) => brand.prefixes.some((p) => startsWithPhrase(normalized, p))) ?? null;
}

/** Sigla di due lettere dalle prime parole del nome ("Energia Italia S.p.A." → "EI"). */
export function nameInitials(name: string): string {
  const words = normalizeName(name).split(" ").filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0];
  return letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
}

/**
 * Icona di uno strumento, senza chiamate esterne. Crypto: icona dal nome o dal simbolo; ETF e fondi: emittente
 * riconosciuto dal nome; azioni: marchio dell'azienda se è tra quelli noti. In tutti gli altri casi una sigla
 * colorata dal tipo (`swatch` del tipo di strumento, scelto dal chiamante).
 */
export function resolveInstrumentIcon(input: InstrumentIconInput, typeSwatch: string): InstrumentIcon {
  const { type, name } = input;
  if (type === "crypto") {
    const file = CRYPTO_ICON_FILES[normalizeName(name)];
    if (file) return { kind: "image", src: `${CRYPTO_ICON_BASE_PATH}/${file}.svg`, label: name };
  } else if (type === "azione") {
    const brand = findBrand(name);
    if (brand) return { kind: "brand", path: brand.path, hex: brand.hex, label: brand.title };
  } else if (type === "etf" || type === "fondo") {
    const issuer = findFundIssuer(name);
    if (issuer) return { kind: "initials", text: issuer.initials, swatch: issuer.swatch, label: issuer.name };
  }
  return { kind: "initials", text: nameInitials(name), swatch: typeSwatch, label: name };
}
