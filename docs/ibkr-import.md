# Import Interactive Brokers

## Comportamento

Importare Activity Statement CSV inglesi completi, consecutivi e in ordine cronologico, iniziando dal periodo con saldi iniziali nulli. Il server rilegge il CSV: modificare le operazioni nella richiesta non modifica i dati importati. Ogni conto del broker ha un portafoglio dedicato e un conto di liquidità, anche negativo. Il saldo del conto usa la cassa del NAV alla data di chiusura, convertita nella valuta utente.

Sono conservati tutti i record originali, incluse le sezioni non normalizzate, nell'export dell'account. Rendiconti mostra NAV, posizioni, costo/P&L comunicati dal broker e movimenti di cassa in valuta originale. Depositi e trasferimenti di valuta non diventano entrate di budget; commissioni già incluse nei trade non vengono addebitate due volte.

La corrispondenza di cassa, quantità e periodi è necessaria prima del salvataggio atomico. Lock per utente e impronta del documento impediscono duplicati anche con richieste concorrenti. Un nuovo CSV sostituisce atomicamente i rendiconti che copre interamente; anteprima e conferma mostrano periodi e operazioni sostituiti. Sovrapposizioni parziali richiedono un export più ampio. Eventuali rendiconti successivi sono conservati solo se cassa e posizioni restano riconciliate. Un errore ripristina integralmente i dati precedenti. Le operazioni del portafoglio riconciliato non si modificano/eliminano singolarmente.

## Gestione importazioni

Da Operazioni → Gestisci importazioni: elenco per periodo, conto e data di caricamento; aggiornamento mediante nuovo CSV e cancellazione con conferma esplicita. La cancellazione di un periodo include i successivi dello stesso conto, perché dipendono dallo storico: l'elenco esatto è verificato nuovamente sul server sotto lock. Saldi e operazioni si aggiornano nella stessa transazione. La liquidità torna al precedente rendiconto o a zero; il conto vuoto, il catalogo e i prezzi storici restano disponibili. Il collegamento conto–portafoglio è persistente, quindi reimportare dopo una cancellazione riusa il conto di liquidità. Nessun dato di altri utenti o conti viene eliminato. Gli import generici precedenti non hanno metadati di batch e restano nella scheda Operazioni.

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

### Gestione importazioni in Operazioni

La gestione dei CSV importati è nella scheda Operazioni, in «Gestisci importazioni» (sezione espandibile chiusa inizialmente) sopra l’elenco delle transazioni, anche quando non ci sono operazioni. La scheda Rendiconti e il suo riepilogo nel Portafoglio sono stati rimossi; i vecchi link reindirizzano a Operazioni. Lo storico dei documenti e le funzioni di sostituzione e cancellazione restano disponibili senza modificare i dati salvati.

## Riparti da zero dopo import preesistenti

Da **Operazioni → Gestisci importazioni → Rimuovi tutti gli import e azzera gli investimenti**, il riepilogo mostra quante operazioni, rendiconti, prezzi personali e conti broker saranno interessati. È obbligatorio digitare `AZZERA INVESTIMENTI`. I vecchi CSV non avevano una provenienza: per rimuovere anche quei duplicati il reset elimina **tutte** le operazioni di investimento, incluse quelle manuali e di altri CSV. Non è un reset dell'intero account.

Il server verifica l'impronta dei dati mostrati e rifiuta conferme obsolete. Reset atomico con lo stesso lock degli import; niente conversioni o richieste esterne. Rimuove anche gli snapshot della classe investimenti (compreso oggi), azzera solo i conti cassa esplicitamente collegati e aggiorna il totale liquidità di oggi. Conserva portafogli, associazioni ai conti cassa, strumenti, prezzi condivisi, impostazioni e minusvalenze inserite a mano. I precedenti snapshot aggregati della liquidità non vengono riscritti: non contengono la quota attribuibile al singolo broker.

Dopo il reset reimportare lo storico completo, dal periodo più vecchio al più recente. Banche e relativi movimenti, budget, debiti e pensioni non sono eliminati. Nessuna migration necessaria. Log `investments.import.reset_completed`/`reset_conflict` e evento Umami `investments_import_reset`, solo conteggi; nessuna nuova metrica o dipendenza. Controllare zero operazioni dopo il reset e un solo inserimento per riga al primo reimport. Schermata di gestione fuori dal tour landing; aggiornato il catalogo, nessun cambiamento alle schermate pubblicate.

## Selezione multipla dei rendiconti

Il selettore e il trascinamento accettano fino a 20 file, 5 MB ciascuno e 25 MB complessivi. Tutti i file devono essere rendiconti completi IBKR o DEGIRO; altri CSV restano supportati singolarmente. Prima di iniziare la coda vengono letti e controllati tutti i file, segnalando il nome di quello non valido.

La coda ordina gli estratti IBKR per conto e periodo, poi DEGIRO (per consentire l'uso del portafoglio IBKR appena creato). Ogni rendiconto mantiene abbinamento strumenti, anteprima e conferma; «File successivo» prosegue senza dover selezionare nuovamente i file. Duplicati già presenti possono essere saltati. Ogni import è atomico separatamente: interrompere il dialogo conserva i file già completati, e una nuova selezione degli stessi file è idempotente. Non è un job in background né una transazione unica sull'intera selezione.

## Selezionare e confrontare broker

Nelle schede Investimenti, i controlli «Broker inclusi nel portafoglio» consentono di vedere IBKR, DEGIRO o entrambi, senza modificare i dati salvati. La selezione si applica a totali, posizioni, performance (inclusa heatmap), diversificazione, proventi, stime fiscali e operazioni. Restano disponibili rendiconti, gestione importazioni e catalogo titoli completi. Il patrimonio generale, i conti e la sidebar restano riferiti a tutti gli asset. Il filtro è temporaneo, si mantiene cambiando scheda e si azzera ricaricando o lasciando la sezione.

In Performance, «Confronto tra broker» sovrappone i rendimenti percentuali TWR dei broker selezionati e il rendimento del portafoglio combinato, ricalcolato sui dati selezionati. L’asse temporale usa date reali; assenza di storico non diventa uno zero artificiale. Con Max le prime date dei broker possono differire, come dichiarato nella card. Le percentuali sono stime dell’app basate sui prezzi disponibili, non rendimenti certificati del broker. Le minusvalenze pregresse inserite manualmente restano impostazioni globali.

Verifica: due broker nello stesso portafoglio/strumento, esclusione e riattivazione, nessun broker selezionato, persistenza tra schede, assenza di mutazioni dei dati originali e confronto 10% + 10% = 10% combinato. Eventi `investment_broker_filter_changed` e `investment_broker_overlay_changed`, solo azioni/conteggi. Nessuna nuova dipendenza o metrica server. Catalogo landing sincronizzato; i dati demo del tour non hanno fonti broker, quindi le schermate pubblicate restano invariate.

### Liquidità nella vista Investimenti

La card Portafoglio offre «Includi liquidità», attivo inizialmente: acceso mostra titoli + saldo dei conti broker collegati, spento solo titoli. Il dettaglio cash con data dell’ultimo rendiconto è espandibile nella stessa card. I filtri broker agiscono su entrambi; i saldi negativi riducono il totale. Ogni conto viene contato una sola volta, anche con più rendiconti o collegamenti precedenti. Il patrimonio generale include già questi conti nella liquidità e non viene modificato. Grafici, rendimenti e pesi delle posizioni continuano a riferirsi ai soli titoli.
