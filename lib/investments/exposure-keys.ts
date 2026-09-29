/**
 * Chiavi chiuse di settore e area geografica usate per la diversificazione (Fase 3 Investimenti): fonti diverse
 * (Yahoo, stime dagli indici, correzioni manuali) si sommano solo se parlano la stessa lingua.
 */

/** Settori azionari (gli stessi 11 di Morningstar/Yahoo). */
export const EQUITY_SECTOR_KEYS = [
  "tecnologia",
  "finanza",
  "salute",
  "industria",
  "consumi_ciclici",
  "consumi_difensivi",
  "comunicazioni",
  "energia",
  "materiali",
  "servizi_pubblici",
  "immobiliare",
] as const;

/** Settori assegnabili a mano: quelli azionari più le voci non azionarie (il "non classificato" è il resto). */
export const MANUAL_SECTOR_KEYS = [...EQUITY_SECTOR_KEYS, "obbligazioni", "liquidita", "materie_prime", "crypto", "altro"] as const;

/** Tutti i settori: una ripartizione "per settore" copre tutto il valore. */
export const SECTOR_KEYS = [...MANUAL_SECTOR_KEYS, "non_classificato"] as const;
export type SectorKey = (typeof SECTOR_KEYS)[number];

/** Aree assegnabili a mano: l'Italia è separata dal resto d'Europa (BTP e azioni italiane sono tipici qui). */
export const MANUAL_AREA_KEYS = ["nord_america", "europa", "italia", "giappone", "pacifico", "emergenti", "nessuna"] as const;

/** Tutte le aree. */
export const AREA_KEYS = [...MANUAL_AREA_KEYS, "non_classificato"] as const;
export type AreaKey = (typeof AREA_KEYS)[number];

export const UNCLASSIFIED = "non_classificato" as const;

export const SECTOR_LABELS: Record<SectorKey, string> = {
  tecnologia: "Tecnologia",
  finanza: "Finanza",
  salute: "Salute",
  industria: "Industria",
  consumi_ciclici: "Consumi ciclici",
  consumi_difensivi: "Consumi di base",
  comunicazioni: "Comunicazioni",
  energia: "Energia",
  materiali: "Materiali",
  servizi_pubblici: "Servizi pubblici",
  immobiliare: "Immobiliare",
  obbligazioni: "Obbligazioni",
  liquidita: "Liquidità",
  materie_prime: "Materie prime",
  crypto: "Crypto",
  altro: "Altro",
  non_classificato: "Non classificato",
};

export const AREA_LABELS: Record<AreaKey, string> = {
  nord_america: "Nord America",
  europa: "Europa",
  italia: "Italia",
  giappone: "Giappone",
  pacifico: "Pacifico",
  emergenti: "Paesi emergenti",
  nessuna: "Senza area",
  non_classificato: "Non classificato",
};

/** Settori di Yahoo (`topHoldings.sectorWeightings`) → chiavi dell'app. */
export const YAHOO_SECTOR_WEIGHTING_KEYS: Record<string, SectorKey> = {
  technology: "tecnologia",
  financial_services: "finanza",
  healthcare: "salute",
  industrials: "industria",
  consumer_cyclical: "consumi_ciclici",
  consumer_defensive: "consumi_difensivi",
  communication_services: "comunicazioni",
  energy: "energia",
  basic_materials: "materiali",
  utilities: "servizi_pubblici",
  realestate: "immobiliare",
};

/** Settore di un'azienda come lo scrive Yahoo (`assetProfile.sector`) → chiave dell'app. */
export const YAHOO_COMPANY_SECTORS: Record<string, SectorKey> = {
  Technology: "tecnologia",
  "Financial Services": "finanza",
  Healthcare: "salute",
  Industrials: "industria",
  "Consumer Cyclical": "consumi_ciclici",
  "Consumer Defensive": "consumi_difensivi",
  "Communication Services": "comunicazioni",
  Energy: "energia",
  "Basic Materials": "materiali",
  Utilities: "servizi_pubblici",
  "Real Estate": "immobiliare",
};

const NORTH_AMERICA = ["US", "CA"];
const EUROPE = [
  "AT", "BE", "BG", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GB", "GR", "HR", "HU", "IE", "IS", "JE",
  "GG", "IM", "LI", "LT", "LU", "LV", "MC", "MT", "NL", "NO", "PT", "RO", "SE", "SI", "SK",
];
const PACIFIC = ["AU", "NZ", "HK", "SG"];
const EMERGING = [
  "AE", "AR", "BR", "CL", "CN", "CO", "EG", "ID", "IN", "KR", "KW", "MX", "MY", "PE", "PH", "PL", "QA", "SA", "TH",
  "TR", "TW", "ZA", "VN",
];

/** Paese (ISO 3166 alpha-2) → area; null se non è in elenco. */
export function areaForCountry(countryCode: string | null | undefined): AreaKey | null {
  if (!countryCode) return null;
  const code = countryCode.toUpperCase();
  if (code === "IT") return "italia";
  if (code === "JP") return "giappone";
  if (NORTH_AMERICA.includes(code)) return "nord_america";
  if (EUROPE.includes(code)) return "europa";
  if (PACIFIC.includes(code)) return "pacifico";
  if (EMERGING.includes(code)) return "emergenti";
  return null;
}

/** Nomi dei paesi come li scrive Yahoo (`assetProfile.country`) → ISO alpha-2, per i paesi più comuni. */
const YAHOO_COUNTRY_CODES: Record<string, string> = {
  "United States": "US",
  Canada: "CA",
  Italy: "IT",
  Japan: "JP",
  "United Kingdom": "GB",
  Germany: "DE",
  France: "FR",
  Netherlands: "NL",
  Switzerland: "CH",
  Spain: "ES",
  Ireland: "IE",
  Belgium: "BE",
  Luxembourg: "LU",
  Denmark: "DK",
  Sweden: "SE",
  Norway: "NO",
  Finland: "FI",
  Austria: "AT",
  Portugal: "PT",
  Australia: "AU",
  "Hong Kong": "HK",
  Singapore: "SG",
  "New Zealand": "NZ",
  China: "CN",
  Taiwan: "TW",
  "South Korea": "KR",
  India: "IN",
  Brazil: "BR",
  Mexico: "MX",
  "South Africa": "ZA",
};

/** Paese di Yahoo in chiaro → ISO alpha-2, o null. */
export function countryCodeFromName(name: string | null | undefined): string | null {
  return name ? (YAHOO_COUNTRY_CODES[name] ?? null) : null;
}

/** Paese dall'ISIN (i primi due caratteri); null per gli ISIN sovranazionali (XS, EU). */
export function countryFromIsin(isin: string | null | undefined): string | null {
  if (!isin || isin.length < 2) return null;
  const prefix = isin.slice(0, 2).toUpperCase();
  return prefix === "XS" || prefix === "EU" ? null : prefix;
}

/** Chiave valida per la dimensione? (per validare i dati salvati e quelli in arrivo dal client). */
export function isSectorKey(key: string): key is SectorKey {
  return (SECTOR_KEYS as readonly string[]).includes(key);
}

export function isAreaKey(key: string): key is AreaKey {
  return (AREA_KEYS as readonly string[]).includes(key);
}
