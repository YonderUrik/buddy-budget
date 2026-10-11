import "server-only";

/**
 * Scrive il link di accesso sullo stdout del server quando non c'è un servizio email (RESEND_API_KEY assente,
 * tipico del self-hosting). Chi legge i log è l'amministratore dell'istanza, che coincide con chi può già
 * leggere il database; in produzione la chiave Resend c'è sempre e questo ramo non viene mai preso.
 * Volutamente fuori da `logger`: l'URL contiene il token e non deve entrare nei campi tipizzati né in Loki.
 */
export function logMagicLink(url: string): void {
  process.stdout.write(`\n[buddybudget] Link di accesso (valido pochi minuti): ${url}\n\n`);
}
