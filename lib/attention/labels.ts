/** Testi dell'avviso "Da sistemare": una sola fonte per sidebar, card e test. */

/** "4 nuove · 7 da categorizzare", omettendo la parte a zero; stringa vuota se non c'è nulla. */
export function describeAttention(newCount: number, uncategorizedCount: number): string {
  const parts: string[] = [];
  if (newCount > 0) parts.push(newCount === 1 ? "1 nuova" : `${newCount} nuove`);
  if (uncategorizedCount > 0) parts.push(`${uncategorizedCount} da categorizzare`);
  return parts.join(" · ");
}

/** Contatore della sidebar: oltre la soglia mostra "99+" per non allargare il badge. */
export const ATTENTION_BADGE_MAX = 99;
export function formatBadgeCount(count: number): string {
  return count > ATTENTION_BADGE_MAX ? `${ATTENTION_BADGE_MAX}+` : String(count);
}
