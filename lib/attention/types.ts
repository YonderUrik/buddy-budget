/** Riepilogo di ciò che richiede attenzione tra i movimenti: serve alla sidebar e alla card "Da sistemare" in Panoramica. */
export interface AttentionSummary {
  /** Transazioni importate automaticamente dopo l'ultima visita ai movimenti. */
  newCount: number;
  /** Transazioni ancora nella categoria di riserva ("Da categorizzare"). */
  uncategorizedCount: number;
  /** Transazioni distinte che sono nuove o da categorizzare (una nuova e da categorizzare conta una volta). */
  totalCount: number;
  /** Id delle transazioni nuove (al più `ATTENTION_NEW_IDS_LIMIT`), per segnare i gruppi della card. */
  newTransactionIds: string[];
}
