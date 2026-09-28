# Fixture delle fonti prezzi

Risposte delle fonti usate dai test dei parser. Quelle con prefisso `synthetic-` sono scritte a mano sul formato
documentato, perché dal sandbox cloud le fonti non sono raggiungibili. Lo script `scripts/probe-price-sources.ts`
(Task 1 del piano investimenti) salva le risposte reali con prefisso `real-`: quando esistono, i test le usano
al posto di quelle sintetiche per verificare che il formato vero non sia cambiato.
