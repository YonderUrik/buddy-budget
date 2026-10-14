# Completezza delle traduzioni dell'app

- Correzione sul branch `codex/localization-completeness`, basato sulla PR #361 ripristinata solo per la prova locale; nessun merge o deploy.
- Cataloghi inglese/tedesco estesi a testi di aiuto, messaggi dinamici, moduli, import, notifiche e conferme; formattazione di date e numeri legata alla lingua esplicita, senza stato globale mutabile.
- Il paese mantiene le proprie capacità indipendenti dalla lingua. Fiscalità, pensione e altre funzioni non ancora implementate per la Germania restano bloccate; nessuna nuova regola finanziaria o migrazione.
- Identificatori, valori dei form e parametri delle API restano stabili. Nomi e descrizioni inseriti/importati dagli utenti non vanno rinominati per cambiare lingua.
- Verifica su database demo isolato: 35 route in IT/en, DE/de e DE/en (105 navigazioni), moduli e aiuto nelle quattro combinazioni; test dei placeholder e della copertura dei messaggi, isolamento delle lingue e calcoli della heatmap. 2.204 test passano; la suite ha un errore preesistente nel test del logger dovuto al nome `mario` nel percorso locale dello stack.
- Nessun nuovo segnale osservabile o funzione di catalogo; aumentano le dimensioni dei cataloghi client. Prima del merge: prova dell'utente; in seguito continuare l'integrazione delle regole specifiche per paese separatamente.

### Categorie predefinite (correzione dopo la prova)

Le categorie fornite dall'app devono seguire la lingua anche dopo l'onboarding. La migration 0037 aggiunge `default_key`, valorizzata dal seed e conservata nell'onboarding per i nomi predefiniti tradotti. Il backfill delle righe precedenti richiede corrispondenza di nome noto, tipo, icona, descrizione e flag fallback; non modifica nomi o collegamenti. Poiché lo schema precedente non registrava l'origine, una categoria ricreata manualmente con tutti gli stessi attributi è indistinguibile da una predefinita. Le categorie nuove create a mano non hanno mai questa chiave.

La query client proietta nomi e descrizioni nella lingua/prodotto correnti, lasciando dati salvati e ID invariati. Una rinomina esplicita rimuove la chiave; salvare il nome tradotto già mostrato non conta come rinomina. Descrizioni personalizzate restano intatte. Il fallback viene tradotto attraverso il suo flag. Account e descrizioni dei movimenti restano dati dell'utente: non vengono tradotti per coincidenza con una voce del catalogo.

Verifica: test delle quattro combinazioni prodotto/lingua, ritorno alla lingua originale, nomi personalizzati uguali a quelli del catalogo, descrizioni per paese, onboarding tradotto e nomi modificati. Verifica browser su liquidità, categorie e analisi e salvataggio di un nome tradotto. Le schermate italiane già rigenerate mantengono gli stessi testi.

Esito della correzione categorie: build e TypeScript riusciti; 76 test mirati superati; 12 combinazioni pagina/profilo verificate nel browser senza errori, inclusi salvataggi senza rinomina. La suite completa prima dell'ultimo test di regressione ha evidenziato il noto errore del logger e un fixture di onboarding senza la nuova identità: fixture corretto e tutti i test interessati rieseguiti con successo. Nessun merge o deploy; preview locale in Italia/inglese.
