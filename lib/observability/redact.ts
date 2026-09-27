/** Lunghezza massima del messaggio di un errore nei log: oltre si tronca (i messaggi esterni possono essere enormi). */
export const MAX_ERROR_MESSAGE_LENGTH = 500;

const REDACTIONS: ReadonlyArray<[RegExp, string]> = [
  [/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [redacted]"],
  [/\b(token|secret|code|access|refresh|password|key)=[^&\s"']+/gi, "$1=[redacted]"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]"],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[id]"],
  [/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g, "[iban]"],
];

/**
 * Rete di sicurezza per testi che non controlliamo (messaggi d'errore di librerie esterne):
 * oscura email, IBAN, UUID, bearer token e parametri segreti in URL, poi tronca.
 * Il meccanismo principale contro le fughe resta il tipo chiuso `LogFields` del logger.
 */
export function redactText(text: string, maxLength: number = MAX_ERROR_MESSAGE_LENGTH): string {
  let out = text;
  for (const [pattern, replacement] of REDACTIONS) out = out.replace(pattern, replacement);
  return out.length > maxLength ? `${out.slice(0, maxLength)}…` : out;
}
