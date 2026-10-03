/** Logica pura della legenda interattiva del grafico del patrimonio netto (quali classi sono nascoste, quali contano nel totale). */

/** Classe che l'utente può escludere dal totale con l'interruttore (non c'entra con il nascondere dalla legenda). */
export const PENSION_CLASS = "previdenza";

/**
 * Nuovo insieme di classi nascoste dopo un clic sulla legenda. Mostrare una classe la toglie dai nascosti; nasconderla
 * la aggiunge, ma mai l'ultima visibile (il grafico non resterebbe vuoto): in quel caso l'insieme resta invariato.
 */
export function toggleHiddenClass(hidden: ReadonlySet<string>, key: string, allClasses: readonly string[]): Set<string> {
  const next = new Set(hidden);
  if (next.has(key)) {
    next.delete(key);
    return next;
  }
  const stillVisible = allClasses.filter((candidate) => candidate !== key && !next.has(candidate));
  if (stillVisible.length === 0) return next;
  next.add(key);
  return next;
}

/** Classi visibili, nell'ordine di impilamento; ignora i nascosti che non esistono più nella serie. */
export function visibleClasses(allClasses: readonly string[], hidden: ReadonlySet<string>): string[] {
  return allClasses.filter((key) => !hidden.has(key));
}

/** Classi che entrano nel totale mostrato: le visibili, meno la previdenza se l'utente l'ha esclusa dal totale. */
export function countedClasses(visible: readonly string[], pensionIncluded: boolean): string[] {
  return visible.filter((key) => key !== PENSION_CLASS || pensionIncluded);
}
