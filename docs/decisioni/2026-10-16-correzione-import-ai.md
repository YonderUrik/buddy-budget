# Correggere un risultato già importato

- Il dettaglio di un import personale o recuperato con AI offre «Il risultato è sbagliato»: descrizione del problema, nuovo caricamento dell’originale e consenso esplicito all’invio di file e segnalazione a OpenRouter con ZDR.
- La nuova analisi resta una proposta: confronto di movimenti, investimenti e variazione di liquidità, poi conferma esplicita. Il parser diventa riutilizzabile solo dopo l’accettazione.
- Sostituzione e storno condividono una transazione; un errore ripristina tutto. Un’impronta dei dati originali impedisce di sovrascrivere modifiche intervenute dopo la richiesta. Scarto e scadenza lasciano intatto l’import originale.
- Manteniamo i job Postgres esistenti, necessari per durabilità, cifratura e coordinamento col registro contabile; migrazione 0041 aggiunge riferimento, impronta e segnalazione cifrata. File, anteprima e segnalazione sono rimossi dopo la conferma o alla scadenza.
- Ambito: import personali e fallback AI dei broker. Gli import nativi dei broker mantengono la gestione esistente. La sostituzione che rimuoverebbe acquisti necessari a vendite successive è bloccata dal controllo esistente: una riconciliazione di più import è un lavoro futuro, da affrontare con la gestione delle dipendenze fra rendiconti.
- La landing descrive il nuovo percorso. Verifica: test su Postgres temporaneo, percorso browser con CSV sintetico e OpenRouter reale, email intercettate localmente; prove in `docs/evidence/import-correction/`.
