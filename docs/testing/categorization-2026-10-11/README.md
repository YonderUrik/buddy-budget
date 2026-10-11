# Verifica categorizzazione

Screenshot dell'app locale su database `buddy_categorization_demo`, con dati fittizi di Giulia Demo. Nessuna chiamata a servizi AI reali durante la verifica.

- Giroconto di 250 € su conto corrente e conto deposito: importi originali visibili, etichetta «Escluso dai conteggi», entrate mensili ancora a zero.
- Categoria disponibile nella sezione «Trasferimenti tra conti».
- Istruzioni personali salvate dalle Impostazioni e ritrovate dopo il ricaricamento.
- Temi chiaro e scuro controllati nel browser.

Test: regressioni su `DB Vertrieb GmbH`, batch 5+5+2, propagazione delle istruzioni e scarto di risposte obsolete; API per assegnazione/ricategorizzazione, importo modificato, entrambi i segni, regole e cambio tipo della categoria.

La suite completa ha un fallimento preesistente in `lib/observability/logger.test.ts`: cerca la parola «mario» nello stack, che qui contiene il percorso `/Users/mario`. Una prima esecuzione ha anche raccolto un test da una cache pnpm temporanea, poi rimossa dal workspace. Vedere la PR per i risultati finali.
