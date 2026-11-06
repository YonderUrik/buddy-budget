/**
 * Italian source strings of the Interactive Brokers connection (translated through `t()`), kept out of the JSX.
 */

/** How to create the Flex Query and the token in IBKR's Client Portal, in the order the user does it. */
export const IBKR_FLEX_GUIDE_STEPS = [
  "Nel Client Portal di Interactive Brokers apri Rendiconti → Flex Queries (Performance & Reports → Flex Queries).",
  "Crea una nuova Activity Flex Query con formato XML e periodo «Last 365 Calendar Days».",
  "Includi le sezioni Account Information, Cash Report, Net Asset Value (NAV) in Base, Open Positions, Trades (Executions), Cash Transactions, Corporate Actions, Transfers e Financial Instrument Information, con tutti i campi.",
  "Lascia il formato data yyyyMMdd e salva: il numero accanto al nome della query è il Query ID.",
  "In Flex Web Service Configuration attiva il servizio e genera un token: scegli la durata più lunga e copialo qui.",
] as const;

export const IBKR_FLEX_FACTS = [
  "Solo lettura: con token e Query ID si possono scaricare rendiconti, non fare operazioni né spostare soldi.",
  "Non chiediamo mai utente e password di Interactive Brokers.",
  "Il token è cifrato sui nostri server e non torna mai al browser. Puoi revocarlo da IBKR quando vuoi.",
] as const;

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
