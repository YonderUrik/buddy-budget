/** Numero di gruppi inviati per richiesta quando si applica la categorizzazione in blocco. */
export const CATEGORIZE_APPLY_BATCH_SIZE = 5;

/**
 * Divide i gruppi selezionati in blocchi da inviare uno alla volta al server: l'operazione resta
 * veloce (nessuna chiamata esterna, solo scritture DB), ma spezzarla in più richieste dà un
 * avanzamento granulare invece di un'unica richiesta bloccante senza feedback.
 */
export function chunkGroups<T>(groups: T[], batchSize: number = CATEGORIZE_APPLY_BATCH_SIZE): T[][] {
  if (batchSize < 1) throw new Error("batchSize deve essere almeno 1");
  const chunks: T[][] = [];
  for (let start = 0; start < groups.length; start += batchSize) {
    chunks.push(groups.slice(start, start + batchSize));
  }
  return chunks;
}
