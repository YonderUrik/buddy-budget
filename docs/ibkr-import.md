# Import Interactive Brokers

## Comportamento

Importare Activity Statement CSV inglesi completi, consecutivi e in ordine cronologico, iniziando dal periodo con saldi iniziali nulli. Il server rilegge il CSV: modificare le operazioni nella richiesta non modifica i dati importati. Ogni conto del broker ha un portafoglio dedicato e un conto di liquidità, anche negativo. Il saldo del conto usa la cassa del NAV alla data di chiusura, convertita nella valuta utente.

Sono conservati tutti i record originali, incluse le sezioni non normalizzate, nell'export dell'account. Rendiconti mostra NAV, posizioni, costo/P&L comunicati dal broker e movimenti di cassa in valuta originale. Depositi e trasferimenti di valuta non diventano entrate di budget; commissioni già incluse nei trade non vengono addebitate due volte.

La corrispondenza di cassa, quantità e periodi è necessaria prima del salvataggio atomico. Lock per utente e impronta del documento impediscono duplicati anche con richieste concorrenti. Un nuovo CSV sostituisce atomicamente i rendiconti che copre interamente; anteprima e conferma mostrano periodi e operazioni sostituiti. Sovrapposizioni parziali richiedono un export più ampio. Eventuali rendiconti successivi sono conservati solo se cassa e posizioni restano riconciliate. Un errore ripristina integralmente i dati precedenti. Le operazioni del portafoglio riconciliato non si modificano/eliminano singolarmente.

## Gestione importazioni

Da Rendiconti → Gestisci importazioni: elenco per periodo, conto e data di caricamento; aggiornamento mediante nuovo CSV e cancellazione con conferma esplicita. La cancellazione di un periodo include i successivi dello stesso conto, perché dipendono dallo storico: l'elenco esatto è verificato nuovamente sul server sotto lock. Saldi e operazioni si aggiornano nella stessa transazione. La liquidità torna al precedente rendiconto o a zero; il conto vuoto, il catalogo e i prezzi storici restano disponibili. Il collegamento conto–portafoglio è persistente, quindi reimportare dopo una cancellazione riusa il conto di liquidità. Nessun dato di altri utenti o conti viene eliminato. Gli import generici precedenti non hanno metadati di batch e restano nella scheda Operazioni.

## Identità e operazioni sul capitale

Il cambio di ISIN presente nel rendiconto risolve gli alias nella stessa identità. ISIN e valuta vengono dal broker, senza scegliere automaticamente una diversa quotazione Yahoo. Gli strumenti manuali sono privati; gli indici distinguono utente e valuta. Si salvano prezzi di chiusura anche per posizioni senza trade nell'ultimo periodo.

Per uno spinoff interamente ceduto nello stesso rendiconto, la somma delle basi delle vendite trasferisce base e quote dal titolo originario al nuovo titolo con rettifiche non monetarie. Se quantità o base non sono ricostruibili, l'import si blocca e chiede il dettaglio dei lotti. Altre operazioni sul capitale non supportate bloccano l'import.

## Limiti espliciti e lavoro futuro

- Le fotografie IBKR sono valori storici esatti del file, non quotazioni correnti. Gli strumenti nuovi hanno prezzi manuali dal rendiconto; il collegamento a una fonte di quotazioni è successivo.
- Costo medio e stime fiscali dell'app non sono il motore fiscale a lotti di IBKR. Revisioni retroattive della base di costo non spiegate dai movimenti sono conservate nei report, non inventate nel registro. Per equivalenza fiscale serve un export dei lotti/corporate actions.
- La migrazione di precedenti import generici richiede un flusso dedicato. Non importare nuovamente lo stesso storico in un portafoglio generico, per evitare doppi conteggi complessivi.
- Un file solo cassa, senza operazioni su titoli, non è ancora gestito dal wizard esistente.

## Verifica

Test di parsing, contabilità e integrazione PostgreSQL coprono anteprima senza scritture, serie consecutive, saldi/prezzi, duplicati concorrenti, isolamento utenti, input manomesso, sovrapposizioni e dati incoerenti. Fixture complete anonimizzate e CSV sintetici riconciliati in `lib/investments/import/__fixtures__`.

Verifica locale sulle quattro esportazioni autorizzate: 134 operazioni (comprese due rettifiche), quattro documenti, nessun duplicato al secondo import. Risultati e dati personali solo nella directory ignorata `test-results/ibkr-replay`. Typecheck e lint senza errori; 111 test mirati superati. La suite completa ha rilevato un test del logger preesistente che cerca la stringa `mario` nello stack e intercetta il percorso locale del checkout; il fallimento del test parser emerso nello stesso run è stato corretto e riverificato nella suite mirata.

Verifica aggiuntiva gestione importazioni: 13 test di integrazione coprono sostituzioni YTD, più periodi coperti, import concorrenti, rollback dopo errore di scrittura, periodi successivi, conferme obsolete, isolamento utente/conto e cancellazione–reimport con riuso della liquidità. Flussi browser verificati con CSV sintetici; i quattro import personali non sono stati modificati.

## Osservabilità e rilascio

Le API usano `withRoute`; import riuscito: `investments.import.completed`, conteggio inserimenti; gli errori di riconciliazione sono risposte 422, senza salvare movimenti. Il wizard mantiene l'evento Umami di import esistente; cancellazione osservabile con log `investments.import.deleted` e Umami `investments_import_deleted` (solo conteggi). Nessun nuovo job/cron/metrica. La deroga sincrona esistente resta: transazione locale breve, storico prezzi in background; la disponibilità dei cambi può richiedere un primo recupero.

Catalogo funzioni, copia landing e otto screenshot delle schede investimenti aggiornati usando esclusivamente il database demo sintetico. Prima del rilascio applicare le migration versionate; nessuna modifica a produzione eseguita durante questa verifica locale.
