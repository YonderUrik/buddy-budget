/**
 * Italian source strings of the Interactive Brokers connection (translated through `t()`), kept out of the JSX.
 */

/** The three steps of the connection, in the order the user does them in IBKR's Client Portal. */
export const IBKR_FLEX_STEPS = ["Query", "Query ID", "Token"] as const;

/** What the connection can and cannot do, as short tags above the steps. */
export const IBKR_FLEX_TRUST = ["Solo lettura", "Mai la password", "Token cifrato"] as const;

/** Settings of the Activity Flex Query: the label is ours, the value is the option's name in IBKR (English, untranslated). */
export const IBKR_FLEX_QUERY_SETTINGS = [
  { label: "Formato", value: "XML" },
  { label: "Periodo", value: "Last 365 Calendar Days" },
  { label: "Formato data", value: "yyyyMMdd" },
] as const;

/** Sections the query must include, with IBKR's names. */
export const IBKR_FLEX_SECTIONS = [
  "Account Information", "Cash Report", "Net Asset Value (NAV) in Base", "Open Positions", "Trades",
  "Cash Transactions", "Corporate Actions", "Transfers", "Financial Instrument Information",
] as const;

/** Settings of the Flex Web Service token. */
export const IBKR_FLEX_TOKEN_SETTINGS = [
  { label: "Durata", value: "la più lunga" },
  { label: "Indirizzo IP", value: "lascia vuoto" },
] as const;

/** IBKR's sign-in page, opened in a new tab from the first step. */
export const IBKR_CLIENT_PORTAL_URL = "https://www.interactivebrokers.com/portal";

/** Refusals caused by the Flex Query itself: «Correggi la query» goes back to the first step. */
export const IBKR_FLEX_QUERY_REASONS: ReadonlySet<string> = new Set(["query_invalid", "missing_sections", "date_format", "multiple_accounts", "invalid_response", "too_large"]);

/** What to tell the user for each closed reason the server returns. */
export const IBKR_FLEX_ERRORS: Record<string, string> = {
  token_expired: "Il token Flex è scaduto: generane uno nuovo in Flex Web Service Configuration e ricollega.",
  token_invalid: "Interactive Brokers non riconosce il token: controlla di averlo copiato tutto, oppure generane uno nuovo.",
  query_invalid: "Interactive Brokers non trova la Flex Query: controlla il Query ID e che sia una Activity Flex Query in XML.",
  ip_restricted: "Il token è limitato a un indirizzo IP: generane uno senza restrizione di IP.",
  account_inactive: "Interactive Brokers dice che il conto o il servizio Flex non è attivo.",
  rate_limited: "Troppe richieste a Interactive Brokers in poco tempo: riprova tra qualche minuto.",
  unavailable: "Interactive Brokers non risponde o non ha ancora i dati pronti: riprova più tardi.",
  timeout: "Interactive Brokers ci sta mettendo troppo a preparare il rendiconto: riprova più tardi.",
  invalid_response: "La risposta di Interactive Brokers non è un rendiconto Flex leggibile: controlla che la query sia in formato XML.",
  too_large: "Il rendiconto è troppo grande: riduci il periodo della Flex Query.",
  missing_sections: "Nella Flex Query mancano delle sezioni: aggiungile e salva la query.",
  date_format: "Il formato data della Flex Query non è supportato: impostalo su yyyyMMdd.",
  multiple_accounts: "La Flex Query deve riguardare un solo conto: creane una per ogni conto.",
  account_changed: "Il rendiconto è di un altro conto: questa connessione è per un conto diverso.",
  import_refused: "Il rendiconto non si può importare così com'è: nessun dato è stato cambiato.",
  invalid_input: "Controlla il token (solo cifre e lettere) e il Query ID (solo cifre).",
  unavailable_here: "Il collegamento con Interactive Brokers non è disponibile su questa installazione.",
  "already-running": "Una sincronizzazione è già in corso.",
  expired: "Il token non è più valido: ricollega il conto.",
  internal: "Qualcosa è andato storto: riprova più tardi.",
};

export const IBKR_FLEX_STATUS = { linked: "Collegato", expired: "Da ricollegare", error: "Da sistemare" } as const;
