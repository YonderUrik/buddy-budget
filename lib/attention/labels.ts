/** Testi dell'avviso "Da sistemare": una sola fonte per card e test. */

/** "4 nuove · 7 da categorizzare", omettendo la parte a zero; stringa vuota se non c'è nulla. */
export function describeAttention(newCount: number, uncategorizedCount: number): string {
  const parts: string[] = [];
  if (newCount > 0) parts.push(newCount === 1 ? "1 nuova" : `${newCount} nuove`);
  if (uncategorizedCount > 0) parts.push(`${uncategorizedCount} da categorizzare`);
  return parts.join(" · ");
}
