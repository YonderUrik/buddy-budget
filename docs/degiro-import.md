# Import DEGIRO nello stesso portafoglio di IBKR

Il wizard riconosce l'export italiano **Account.csv** (Estratto conto), conserva tutte le righe originali e importa acquisti, vendite e dividendi netti delle rettifiche. Con un solo portafoglio lo seleziona automaticamente; con più portafogli occorre scegliere la destinazione. Una fonte già importata mantiene la propria destinazione.

## Riconciliazione e costi

- Date di registrazione, non date valuta; stesso minuto ordinato come nel saldo progressivo DEGIRO.
- Saldi progressivi e totale verificati separatamente per valuta. Le righe interne di sweep flatex restano archiviate ma non vengono contate due volte nel saldo economico.
- Commissioni e imposte EUR suddivise una sola volta tra gli eseguiti dello stesso ordine, proporzionalmente al controvalore. Le imposte sugli acquisti entrano anche nella base di costo dell'app.
- Prezzi in pence GBX normalizzati in GBP. Le coppie FX collegate all'ordine forniscono il cambio effettivo EUR; quando assenti si usa il normale cambio storico dell'app.
- Dividendi e ritenute stornati/riprenotati nella stessa giornata vengono compensati. Interessi, costi di connessione e altre voci di cassa supportate restano nel ledger, senza attribuirli arbitrariamente al profitto di un titolo.
- Movimenti sconosciuti, costi non abbinabili, storia incompleta e saldi incoerenti bloccano l'import anziché scartare righe finanziarie.

## Portafoglio condiviso e gestione importazioni

La migration 0021 aggiunge l'origine alle operazioni e una relazione persistente tra fonte, portafoglio e conto cassa. IBKR e DEGIRO condividono il portafoglio, mantenendo conti cassa e import distinti. Sostituzione degli overlap e cancellazione delle dipendenze operano esclusivamente sulla stessa fonte. Il file identico è idempotente. I periodi parzialmente sovrapposti richiedono un export che copra interamente gli import coinvolti, come per IBKR.

## Limiti espliciti

Account.csv non contiene NAV, prezzi di chiusura, snapshot certificati delle posizioni o un identificativo del conto. Il report mostra la cassa e dichiara l'assenza della valutazione; non inventa NAV né chiusure. Le posizioni dell'app derivano dalle operazioni. Per ora è supportato un solo conto DEGIRO per utente. Export in altre lingue, altri tipi di file e trasferimenti titoli non riconosciuti richiedono un'estensione dedicata. La ricostruzione fiscale per lotti rimane fuori scope.

## Verifica locale e osservabilità

Verificato il file reale fornito insieme ai quattro rendiconti IBKR: 146 eseguiti e 10 dividendi, 985 righe conservate incluse le intestazioni, nessun errore di riconciliazione; reimport senza duplicati e documenti IBKR invariati. 147 test mirati superati, controllo tipi e lint senza errori; verificato in browser anche il reimport con 156 operazioni già presenti. I file personali e gli artefatti di verifica sono esclusi da Git. La fixture pubblica è interamente sintetica. I test coprono costi condivisi, GBX/FX, storni, isolamento tra broker, sostituzione e cancellazione in entrambe le direzioni.

Riutilizzati i log `investment_import.*`, gli eventi Umami del wizard con provider `degiro` e le metriche dei job esistenti; nessuna nuova dipendenza esterna o metrica dedicata. In produzione verificare gli esiti del job, assenza di errori di riconciliazione e conteggi coerenti con l'anteprima. Catalogo landing sincronizzato; nessuna modifica visibile alle schermate demo pubblicate (wizard e rendiconti non fanno parte del tour).
