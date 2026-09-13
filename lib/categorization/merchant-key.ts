/**
 * Token di rumore bancario: parole che compaiono nelle descrizioni di movimento senza
 * identificare il merchant. Rimuoverle è ciò che impedisce a "PAGAMENTO POS" di far
 * sembrare simili due esercenti del tutto scorrelati.
 */
export const MERCHANT_NOISE_TOKENS: ReadonlySet<string> = new Set([
  "pagamento", "pagam", "pag", "pos", "carta", "cartasi", "acquisto", "addebito",
  "accredito", "bonifico", "sepa", "sdd", "rid", "rif", "cod", "codice", "operazione",
  "oper", "ricarica", "prelievo", "prelevamento", "bancomat", "contactless", "ecommerce",
  "internet", "online", "presso", "eur",
]);
// Nota deliberata: articoli e preposizioni ("il", "del", "su") NON sono in questa lista.
// Rimuoverli fonderebbe merchant distinti — "IL FORNAIO" e "FORNAIO" collasserebbero sulla
// stessa chiave, e una regola imparata sull'uno si applicherebbe da sola all'altro.

/** Suffissi di forma societaria: non distinguono un merchant da un altro. */
export const COMPANY_SUFFIX_TOKENS: ReadonlySet<string> = new Set([
  "spa", "srl", "srls", "sas", "snc", "spa", "sp", "ltd", "limited", "inc", "llc",
  "bv", "nv", "gmbh", "ag", "sa", "plc", "co",
  // Singole lettere da acronimi tipo S.R.L., S.p.A., S.A.S., ecc.
  "s", "r", "l", "p", "a",
]);

/** Descrizione ridotta a minuscolo, senza diacritici, con punteggiatura sostituita da spazi. */
function normalize(description: string): string {
  return description
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Chiave stabile che identifica un merchant a partire dalla descrizione di una transazione:
 * rimuove diacritici, punteggiatura, token puramente numerici, rumore bancario e suffissi
 * societari. Se dopo la pulizia non resta nulla di significativo (descrizione di solo rumore
 * o solo numeri) ricade sulla descrizione normalizzata, per non collassare movimenti diversi
 * su una chiave vuota condivisa.
 */
export function merchantKey(description: string): string {
  const normalized = normalize(description);
  if (normalized.length === 0) return "";

  const meaningful = normalized
    .split(" ")
    .filter((token) => token.length > 0)
    .filter((token) => !/^\d+$/.test(token))
    .filter((token) => !MERCHANT_NOISE_TOKENS.has(token))
    .filter((token) => !COMPANY_SUFFIX_TOKENS.has(token));

  return meaningful.length > 0 ? meaningful.join(" ") : normalized;
}

/** Insieme dei token di una chiave merchant, per il confronto di similarità. */
export function merchantKeyTokens(key: string): Set<string> {
  return new Set(key.split(" ").filter((token) => token.length > 0));
}

/** Indice di Jaccard tra due insiemi di token: |intersezione| / |unione|; 0 se uno dei due è vuoto. */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersectionSize = 0;
  for (const token of a) {
    if (b.has(token)) intersectionSize += 1;
  }
  const unionSize = a.size + b.size - intersectionSize;
  return intersectionSize / unionSize;
}
