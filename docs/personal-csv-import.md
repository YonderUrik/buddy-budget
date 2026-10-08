# CSV personali

Da **Movimenti → Importa un CSV personale** oppure dal selettore degli import investimenti si apre `/importazioni`. L’utente indica banca/broker e carica un CSV UTF-8 con intestazioni, massimo 25 MB, 50.000 righe e 100 colonne. Il consenso esplicito è registrato sul job con versione `openrouter-zdr-v1` e data di creazione.

L’interfaccia mostra circa un’ora e il relativo orario locale di completamento previsto. È una stima: non viene introdotta attesa artificiale e un superamento viene segnalato. La pagina si aggiorna ogni 10 secondi. Email pronta/errore rimanda all’anteprima; nessun inserimento finanziario automatico.

## Configurazione e avvio

App e worker: `DATABASE_URL`, `PERSONAL_CSV_ENCRYPTION_KEY` (32 byte casuali in base64). Generarla una volta con `openssl rand -base64 32`; conservarla come secret e in backup. La rotazione richiede ricifrare i dati con vecchia e nuova chiave; sostituirla direttamente rende i parser esistenti illeggibili.

Modello scelto: [DeepSeek V4.1 Flash](https://openrouter.ai/deepseek/deepseek-v4.1-flash), configurato con `OPENROUTER_MODEL=deepseek/deepseek-v4.1-flash`. Resta modificabile tramite variabile ambiente. Per DeepSeek il worker disabilita il ragionamento opzionale, che sul CSV completo può consumare tutto il budget senza produrre codice e riserva 32.768 token complessivi alla generazione (timeout 240 secondi); una risposta troncata viene segnalata esplicitamente senza importare dati.

Solo worker: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `RESEND_API_KEY`, `RESEND_FROM`, `APP_URL`; eventuali credenziali dei provider cambi già previsti dal progetto. Il modello deve supportare JSON mode tramite un provider che accetta `zdr: true`, `data_collection: deny`, `require_parameters: true`. Non c’è fallback a provider con conservazione dei dati. Il contesto del modello deve contenere l’intero CSV; se il provider rifiuta l’input, il job fallisce con un messaggio esplicito, senza troncare il file. La chiave OpenRouter non serve nel pod web.

Eseguire le migration con `pnpm db:migrate`, l’app con `pnpm dev`, il worker in un altro processo con `pnpm worker:csv`. In produzione costruire l’immagine `docker build --target csv-worker ...`; il target finale predefinito resta l’app. La CI di release pubblica anche `buddy-budget-csv-worker` con lo stesso tag versione. Esempio Deployment in [deployment/personal-csv-worker.yaml](deployment/personal-csv-worker.yaml): sostituire immagine e riferimenti ai secret nel repository infra prima del rilascio. Configurare anche il limite body dell’ingress ad almeno 51 MiB: il CSV da 25 MiB viaggia in JSON. Next proxy è configurato a 51 MiB e la route verifica i byte effettivi del CSV. Questo cambiamento non effettua il deploy né crea secret di produzione.

## Esecuzione e dati

- Postgres: claim con `FOR UPDATE SKIP LOCKED`, lease di 5 minuti, token di fencing, massimo 3 tentativi con attesa crescente. Un worker esegue un job alla volta; pod aggiuntivi possono consumare la stessa coda.
- File cifrato AES-256-GCM, AAD legata all’utente; cancellato al termine o al fallimento definitivo. Anteprima cifrata disponibile per 7 giorni e cancellata alla conferma. Pulizia TTL nello stesso worker; se il worker è fermo l’API nega comunque l’accesso ai payload scaduti. Formati e versioni persistono fino al reset/eliminazione dell’account.
- Nessun CSV privato nelle fixture o nei log. All’AI vanno intestazioni e **tutte le righe, senza campionamento o troncamento**, email e IBAN riconoscibili oscurati. Non è anonimizzazione completa: descrizioni finanziarie possono contenere nomi. Il consenso lo dichiara.
- Prima mapping dichiarativo per CSV di cassa semplici; altrimenti funzione JavaScript sincrona che trasforma una tabella già parsata. Codice sempre validato ed eseguito nel worker, mai nella richiesta web.
- Sandbox QuickJS/WASM nuova per invocazione: 256 MiB di heap, 512 KiB di stack, interrupt dopo 3 secondi; processo figlio senza variabili segrete, limite heap Node 512 MiB, kill dopo 6 secondi anche per regex non interrompibili; output massimo 64 MiB. Nessuna funzione host, rete, filesystem, `require` o `process` esposta al modello. I limiti del pod sono un ulteriore confine sulle risorse.
- Ogni riga produce esattamente un esito: movimento, investimento, esclusione motivata, errore. Date reali non future, valute e limiti numerici validati. Errori bloccano tutto e restano visibili. Le verifiche strutturali non possono provare la correttezza semantica del modello: la revisione umana è obbligatoria.
- Parser privato per formato, versioni immutabili. Stesse intestazioni/delimitatore riusano il parser senza AI; nuovi header o rigenerazione esplicita creano una nuova versione solo se valida. I cambi di significato con header identici richiedono rigenerazione da parte dell’utente.
- Cassa, investimenti, strumenti privati e ricevute di import vengono scritti nella stessa transazione con lock per utente; errori e vendite oltre le quote possedute annullano tutto. I cambi storici vengono recuperati nel worker e controllati alla conferma.
- Doppioni: hash della riga originale e numero di occorrenza nel file, per formato. Conserva ripetizioni legittime identiche nello stesso file e riconosce riimportazioni con righe spostate. File con descrizioni cambiate, ordinamenti delle colonne diversi o ripetizioni indistinguibili in export parziali richiedono revisione. Interpretazione diversa di una riga già importata blocca la conferma; non corregge lo storico in silenzio.
- Email con claim indipendente e retry ogni 15 minuti, chiave di idempotenza Resend per job; oltre la finestra di deduplicazione del provider può esserci una notifica ripetuta se il processo termina dopo l’invio e prima del salvataggio.

## Perimetro finanziario

Cassa: pagamenti, entrate e giroconti (esclusi dal budget). Investimenti: acquisti, vendite, dividendi e cedole; commissioni e imposte convertite nella valuta dell’utente. I movimenti di regolamento degli investimenti sono esclusi dal budget per non duplicare spese/redditi. Un conto e un portafoglio dedicati per fonte evitano abbinamenti impliciti ai conti collegati.

Saldo iniziale zero: occorre storico completo oppure correzione manuale del saldo dopo l’import. Non inferiamo un saldo bancario ufficiale da uno storico parziale. Strumenti privati con prezzi manuali; l’utente può aggiornare le quotazioni nel flusso esistente. Operazioni societarie e obbligazioni che richiedono nominale/rateo vengono rifiutate: utilizzare l’import supportato o l’inserimento manuale. Non promettiamo di interpretare qualsiasi CSV.

## Monitoraggio e verifiche

Eventi strutturati `personal_import.*` solo con stato, conteggi e job ID, mai nome fonte, CSV o risposta modello. Umami registra richiesta/riuso/conferma e numero righe. `/api/metrics` espone gauge `buddybudget_personal_csv_pending`, `_overdue`, `_failed`, `_emailPending`: allertare quando overdue/emailPending crescono o il worker non è disponibile. Applicare le regole nel repository infra insieme al Deployment.

Test: `pnpm exec vitest run lib/personal-import`, con Postgres locale e provider/email simulati. Coprono sandbox (loop, regex, memoria, accesso host), cifratura, schema, isolamento utenti, riuso, doppioni, concorrenza, recupero lease, retry, email, TTL, rollback atomico e portabilità. La prova reale di OpenRouter richiede i due secret del worker; non fa parte dei test automatici.
