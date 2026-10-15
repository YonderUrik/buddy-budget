# Metadati dei formati e recupero dell’importazione

- Raccogliamo istituzione (con provenienza del riconoscimento), sezioni, colonne originali, mapping dichiarato e campi effettivamente prodotti. I profili sono privati per utente e motore, versionati, deduplicati per firma e inclusi in export/reset account. Non contengono esempi o valori delle transazioni; le intestazioni sono protette dalla cifratura applicativa.
- Un parser personale salvato che non supera esecuzione, copertura, determinismo o riconoscimento delle righe viene sostituito automaticamente dall’AI. Prima della chiamata ritiriamo il parser dal job in modo persistente; i retry non ripartono dal parser guasto. Restano tre tentativi complessivi e la revisione delle righe non risolte.
- Il wizard broker offre consenso al recupero AI automatico, per file singoli e batch. Il server verifica nuovamente il fallimento. Errori finanziari richiedono riconciliazione: il recupero AI non può ignorarli né duplicare precedenti importazioni native. File già leggibili restano nel flusso broker.
- Il consenso passa a `openrouter-raw-zdr-v3`: il testo precedente prometteva che il riuso non inviava dati all’AI. I job precedenti non attivano la nuova rigenerazione automatica; una nuova analisi raccoglie il consenso aggiornato.
- Il supporto riceve una diagnosi tecnica senza CSV, valori o codice, anche quando il recupero riesce. Claim, idempotenza e retry email sono separati dall’import; la metrica emailPending include le notifiche al supporto. Restano le normali email all’utente.
- I parser generici condivisi sono un passo futuro: i profili raccolti sono osservazioni, non un’autorizzazione a condividere codice o a fidarsi automaticamente di un’istituzione dedotta dall’AI. Le migrazioni sono verificate su Postgres temporaneo; il DB di sviluppo corrente ha una divergenza preesistente (`product_country` già presente), da riallineare prima di applicarle lì.

## Verifica end-to-end del 16 ottobre

Browser reale, Postgres/Redis locali e OpenRouter reale: provati il parser personale salvato guasto e il CSV non riconosciuto dal dialogo broker. Le email Resend sono intercettate dal test, senza invii reali. Evidenze e riproduzione in `docs/evidence/import-fallback/README.md`.
Il test ha rilevato un parser AI che eliminava il punto decimale (`-12.50` diventava `-1250`). Il controllo indipendente delle colonne importo direttamente mappate ora rifiuta tali risultati prima della persistenza; il prompt chiarisce entrambe le notazioni. Non copre riconciliazioni multi-colonna, sezioni o numeri ambigui: quelle restano un limite esplicito, non una garanzia implicita di accuratezza AI.

Le migrazioni non rilasciate 0040 e 0041 sono state accorpate in 0040; il registro del database locale già migrato è stato riallineato senza cambiare dati o schema. Gli snapshot Drizzle sono marcati come generati in `.gitattributes`.

## Commissioni inclusive di Bitpanda

Una verifica locale ha trovato un secondo errore: il parser AI aggiungeva le commissioni a un prezzo che le includeva già. Il prompt ora impone la riconciliazione di ogni addebito/accredito e spiega come ricavare il prezzo prima delle commissioni senza alterare quantità o azzerare costi. La convenzione è documentata da [Bitpanda](https://support.bitpanda.com/hc/it/articles/360000902525-Quali-commissioni-e-sovrapprezzi-posso-aspettarmi-di-pagare-su-Bitpanda).
Un controllo indipendente confronta importi fiat, quantità e commissioni degli export crypto Bitpanda riconosciuti sia dopo l'esecuzione del parser sia prima di confermare l'anteprima. Comprende anche i parser salvati; non assume la stessa convenzione per altri broker. Tasse non nulle, costi in altra valuta e classi non supportate richiedono revisione. Le fixture committate sono interamente sintetiche.
