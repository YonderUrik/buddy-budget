/**
 * Testi legali pubblici (Privacy, Termini, Cookie). Dati del titolare e versione stanno in `LEGAL_OWNER` / `LEGAL_VERSION`:
 * la versione cambia ogni volta che cambia un testo in modo sostanziale (serve a chiedere una nuova accettazione agli utenti).
 * Non sono un parere legale: restano da far rivedere a un professionista.
 */

/** Versione dei documenti (data dell'ultima modifica sostanziale). */
export const LEGAL_VERSION = "2026-10-22";

export const LEGAL_OWNER = {
  name: "Daniele Roccaforte",
  email: "privacy@buddybudget.io",
  address: "via Lancia 62, 10141 Torino (TO), Italia",
} as const;

/** Durate citate nell'informativa: tenerle allineate al codice e all'infrastruttura. */
export const SESSION_DAYS = 7;
export const MAGIC_LINK_MINUTES = 10;
export const DEACTIVATION_DAYS = 30;
/** Account senza accessi eliminato dopo questi giorni, con avviso via email `INACTIVITY_NOTICE_DAYS` giorni prima (`lib/account/constants.ts`). */
export const INACTIVITY_DAYS = 90;
export const INACTIVITY_NOTICE_DAYS = 7;
export const BACKUP_DAYS = 14;
export const BANK_CONSENT_DAYS = 90;
/** Retention di Loki nel repo infra (`limits_config.retention_period`). */
export const LOG_DAYS = 30;
/** Anteprima cifrata di un import CSV con AI (`expiresAt` in lib/personal-import/jobs.ts). */
export const CSV_PREVIEW_DAYS = 7;
/** Registro degli invii delle email di riepilogo e avviso (`NOTIFICATION_LOG_RETENTION_DAYS` nell'app). */
export const NOTIFICATION_LOG_DAYS = 90;

/** Segnalazioni al supporto: tempo massimo di conservazione dopo la chiusura. */
export const SUPPORT_MONTHS = 12;

export interface LegalSection {
  id: string;
  title: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
}

export interface LegalDocument {
  slug: "privacy" | "termini" | "cookie" | "privacy-en" | "terms-en" | "cookies-en";
  title: string;
  description: string;
  intro: string;
  sections: readonly LegalSection[];
}

export const PRIVACY: LegalDocument = {
  slug: "privacy",
  title: "Informativa sulla privacy",
  description: "Come BuddyBudget tratta i tuoi dati personali e finanziari, con chi li condivide e come esercitare i tuoi diritti.",
  intro:
    "Questa informativa spiega quali dati raccoglie BuddyBudget, perché, per quanto tempo li conserva e che cosa puoi fare per controllarli. È scritta ai sensi degli articoli 13 e 14 del Regolamento (UE) 2016/679 (GDPR).",
  sections: [
    {
      id: "titolare",
      title: "Chi è il titolare del trattamento",
      paragraphs: [
        `Il titolare è ${LEGAL_OWNER.name}, persona fisica, che gestisce BuddyBudget a titolo gratuito. Indirizzo: ${LEGAL_OWNER.address}.`,
        `Per qualunque richiesta sulla privacy scrivi a ${LEGAL_OWNER.email}. Non è stato nominato un responsabile della protezione dei dati (DPO): non è obbligatorio per il livello attuale del trattamento. Non c'è un indirizzo PEC.`,
      ],
    },
    {
      id: "dati",
      title: "Quali dati trattiamo",
      items: [
        "Dati dell'account: nome, indirizzo email, valuta e preferenze scelte. Se accedi con Google, anche la foto del profilo.",
        "Dati finanziari che inserisci tu o che importi: conti, saldi, transazioni (con descrizione, note, controparte e, se il file importato la contiene, la categoria scritta dalla tua banca), categorie, budget, investimenti, debiti, fondi pensione e patrimonio netto. Le descrizioni possono contenere informazioni su abitudini, acquisti o contesti personali: non ti chiediamo mai di inserire dati sulla salute, sulle opinioni o altre categorie particolari, ma possono emergere dai testi delle transazioni.",
        "Dati bancari: se hai già un conto collegato con Open Banking (oggi non se ne collegano di nuovi), tramite GoCardless riceviamo i conti e le transazioni che autorizzi. Non vediamo né conserviamo le credenziali della tua banca.",
        "File che carichi per l'import: estratti conto e rendiconti (per esempio CSV o file dei broker). Se scegli l'import con intelligenza artificiale, il file viene conservato cifrato solo per il tempo dell'elaborazione (vedi la sezione dedicata).",
        "Proposte di categoria: se attivi l'assistente, per ogni esercente conserviamo il nome normalizzato, la categoria proposta e se l'hai confermata o corretta (mai importi o date), insieme alla data del tuo consenso.",
        "Messaggi al supporto: se scrivi dalla pagina Aiuto, riceviamo il testo, l'indirizzo email dell'account e, se non lo togli, un contesto tecnico (pagina, versione dell'app, dimensioni e tema dello schermo, tipo di browser).",
        `Dati tecnici di accesso: data, indirizzo IP troncato (l'ultima parte viene azzerata) e tipo di dispositivo delle sessioni, visibili in Impostazioni, per proteggere l'account.`,
        "Registro dell'accettazione: la data e la versione dei Termini e dell'informativa che hai accettato.",
        "Registri tecnici (log) pseudonimizzati: eventi e errori dell'app, collegati a te solo da un codice che non contiene email, nome, importi o descrizioni.",
        "Statistiche d'uso anonime: pagine viste e azioni compiute (per esempio \"transazione aggiunta\"), senza importi né testi tuoi.",
      ],
    },
    {
      id: "finalita",
      title: "Perché li trattiamo e su quale base",
      paragraphs: ["Per ogni finalità indichiamo la base giuridica prevista dall'articolo 6 del GDPR."],
      items: [
        "Fornirti il servizio (account, conti, transazioni, investimenti, debiti, pensione, import, sincronizzazione dei collegamenti bancari già attivi, export dei dati): esecuzione del contratto, art. 6.1.b.",
        "Inviarti email di servizio (link di accesso, avvisi di scadenza del collegamento bancario, esito degli import, conferme di disattivazione): esecuzione del contratto, art. 6.1.b. Queste email non si possono disattivare perché servono a usare l'account.",
        "Inviarti, solo se li attivi in Impostazioni → Notifiche, il riepilogo periodico (con le cifre di entrate, spese e budget che vedi già nell'app) e gli avvisi sui budget e sulle rate in scadenza: il tuo consenso, art. 6.1.a. Sono spenti finché non li scegli, ogni email ha il link per disattivarla con un clic (senza accedere) e puoi cambiare idea quando vuoi. Non inviamo email promozionali né consigli personalizzati.",
        "Analizzare con l'intelligenza artificiale un file di import non riconosciuto: il tuo consenso esplicito, art. 6.1.a, che dai prima di caricare il file e puoi non dare usando gli altri tipi di import o l'inserimento manuale. Il consenso non è condizione per usare il resto del servizio.",
        "Proporti una categoria per i movimenti nuovi con un servizio di intelligenza artificiale (e, se lo scegli, applicare da sole le proposte più sicure): il tuo consenso esplicito, art. 6.1.a, che dai in Impostazioni (o nell'onboarding) e puoi revocare quando vuoi. Il consenso non è condizione per usare il resto del servizio: puoi categorizzare a mano o con le regole.",
        "Rispondere ai messaggi inviati dalla pagina Aiuto: esecuzione del contratto, art. 6.1.b, per le richieste legate al tuo account; legittimo interesse, art. 6.1.f, per idee e segnalazioni generiche.",
        "Sicurezza, prevenzione degli abusi, diagnosi di errori e continuità del servizio (sessioni, log, backup): legittimo interesse, art. 6.1.f, bilanciato dal fatto che i log sono pseudonimizzati e di breve durata.",
        "Capire quali funzioni vengono usate per migliorare il prodotto, con statistiche anonime: legittimo interesse, art. 6.1.f. Puoi disattivarle in qualunque momento (vedi la pagina sui cookie).",
        "Conservare la prova della tua accettazione di Termini e informativa: legittimo interesse, art. 6.1.f, a poterla dimostrare.",
        "Rispettare obblighi di legge, se e quando applicabili: art. 6.1.c.",
      ],
    },
    {
      id: "open-banking",
      title: "Collegamento bancario (Open Banking)",
      paragraphs: [
        `Oggi non si collegano banche nuove: chi ha già un collegamento lo tiene e lo rinnova come prima. Il collegamento passa da GoCardless Bank Account Data, un fornitore di servizi di informazione sui conti autorizzato ai sensi della direttiva PSD2. Autorizzi l'accesso direttamente presso la tua banca; l'autorizzazione dura al massimo ${BANK_CONSENT_DAYS} giorni, dopo i quali va rinnovata, e puoi revocarla quando vuoi.`,
        "Il consenso che dai alla tua banca e a GoCardless è distinto da questa informativa. Se elimini l'account o fai il reset dei dati revochiamo i collegamenti attivi presso GoCardless. Possiamo rimuovere da GoCardless anche i collegamenti scaduti o non più usati.",
        "Se premi «Tienimi aggiornato» salviamo la richiesta insieme al tuo account e al paese che hai scelto, e ti scriviamo una sola email quando il collegamento torna disponibile: è il tuo consenso, art. 6.1.a. Lo ritiri con «Non avvisarmi più» nello stesso punto dell'app; la richiesta si cancella anche con l'account.",
      ],
    },
    {
      id: "intelligenza-artificiale",
      title: "Import con intelligenza artificiale",
      paragraphs: [
        "Se carichi un CSV in un formato che BuddyBudget non conosce, puoi chiedere di analizzarlo con un modello di intelligenza artificiale che scrive le regole di lettura del file. Prima di inviarlo ti viene chiesto un consenso esplicito.",
        "Al modello viene inviato il testo completo del file e il nome della fonte che hai indicato, anche se contiene dati personali tuoi o di terzi (per esempio i nomi delle controparti nelle descrizioni). Il servizio usato è OpenRouter, che instrada la richiesta verso un fornitore del modello. Richiediamo che il fornitore non conservi i dati dopo la risposta (modalità zero data retention) e non li usi per addestrare i modelli; se nessun fornitore rispetta queste condizioni, l'analisi non parte.",
        `Il file è conservato cifrato sui nostri server e cancellato al termine dell'elaborazione. L'anteprima del risultato resta cifrata per ${CSV_PREVIEW_DAYS} giorni, oppure fino al salvataggio. Le regole di lettura generate per il tuo formato restano finché non elimini l'account o fai il reset dei dati. Le regole sono eseguite sui nostri server, in un ambiente isolato, senza accesso alla rete.`,
        "Le regole sono generate automaticamente e controllate in modo automatico, non da una persona: verifica sempre che i movimenti importati corrispondano al tuo estratto. Puoi eliminare in qualunque momento un import da Investimenti → Operazioni → Gestisci importazioni.",
      ],
    },
    {
      id: "proposte-categorie",
      title: "Proposte di categoria con intelligenza artificiale",
      paragraphs: [
        "Se lo attivi in Impostazioni → Assistente per le categorie (è spento finché non lo scegli), per i movimenti nuovi di sincronizzazioni e importazioni inviamo a un modello di intelligenza artificiale il nome pulito dell'esercente, la direzione (entrata o uscita) e l'elenco delle tue categorie, con qualche esempio di tue scelte passate e le istruzioni personali che scegli di inserire nelle Impostazioni. Evita di inserire dati personali o bancari nelle istruzioni. Non inviamo importi, date, IBAN, note, descrizioni complete dei movimenti, bonifici né nomi che sembrano di persona.",
        "Il servizio è OpenRouter, con la modalità zero data retention descritta nella sezione seguente. Il modello propone una categoria con un grado di sicurezza. Se in Impostazioni lasci attiva l'opzione «Lascia che l'app scelga quando è abbastanza sicura», le proposte sicure almeno al 70% si applicano senza chiederti conferma: le ritrovi in Categorizza → «Messe dall'app», con l'indicazione che vengono dall'intelligenza artificiale, e puoi cambiarle in ogni momento. Le altre proposte restano da confermare, e una scelta diventa una regola solo se lo chiedi tu. Puoi spegnere l'applicazione automatica o revocare il consenso in ogni momento: da quel momento non partono nuove richieste e le proposte già ricevute non si applicano più da sole.",
      ],
    },
    {
      id: "zero-data-retention",
      title: "Zero data retention per l'intelligenza artificiale",
      paragraphs: [
        "Ogni richiesta all'intelligenza artificiale (import di un file, proposte di categoria, «Chiedi all'AI» su un movimento) passa da OpenRouter con la modalità zero data retention: OpenRouter la manda solo a fornitori del modello che non conservano i dati dopo la risposta e non li usano per addestrare i modelli. Se nessun fornitore rispetta queste condizioni, la richiesta viene rifiutata e non parte.",
        "La condizione è imposta due volte: è scritta in ogni richiesta che parte dai nostri server ed è attiva nelle impostazioni del nostro account OpenRouter per tutti i modelli, così vale anche se una delle due venisse a mancare. OpenRouter non conserva il testo delle richieste e delle risposte; tiene i dati tecnici dell'uso (modello, quantità di testo elaborata, costo).",
        `Cosa non copre: la modalità riguarda i fornitori a cui OpenRouter passa la richiesta, non quello che conserviamo noi. Da noi restano, come descritto nelle sezioni sopra, il risultato (le regole di lettura del file, la categoria proposta) e registri tecnici senza il contenuto delle richieste, per ${LOG_DAYS} giorni. Non usiamo strumenti aggiuntivi di OpenRouter come la ricerca sul web.`,
        "Vale per il servizio su buddybudget.io. Chi installa BuddyBudget sui propri server usa una propria chiave OpenRouter: le richieste continuano a chiedere la zero data retention, ma le impostazioni dell'account sono quelle di chi installa.",
      ],
    },
    {
      id: "destinatari",
      title: "Con chi condividiamo i dati",
      paragraphs: [
        "Non vendiamo i tuoi dati e non li usiamo per pubblicità. Li comunichiamo solo ai fornitori che servono a far funzionare il servizio, nominati responsabili del trattamento o, dove agiscono come titolari autonomi, indicati come tali. I servizi di prezzi, cambi e loghi degli strumenti sono interrogati dai nostri server con soli simboli, codici ISIN o nomi di titoli, mai con dati che ti identificano. Per i loghi degli esercenti il servizio di loghi (Logo.dev) riceve dai nostri server solo il sito di un marchio (scritto nei movimenti o noto a noi) o, per i nomi presenti nei movimenti di più utenti, il nome dell'esercente: mai bonifici, importi o chi ha fatto il movimento. Possiamo comunicare dati alle autorità quando la legge lo impone. I fornitori sono:",
      ],
      items: [
        "Hostinger: server (VPS) in Germania, dove girano app e database.",
        "Cloudflare: instradamento del traffico, DNS e archiviazione (R2) delle copie di sicurezza del database.",
        "GoCardless: lettura dei conti bancari già collegati (oggi non se ne collegano di nuovi), ai sensi di PSD2.",
        "Resend: invio delle email di servizio e, se le attivi, di riepilogo e avvisi (usa il tuo indirizzo email e il testo delle email, che può contenere cifre del tuo budget) e consegna dei messaggi che scrivi al supporto.",
        "OpenRouter e il fornitore del modello che questo seleziona, sempre in modalità zero data retention: solo se usi l'import con intelligenza artificiale o le proposte di categoria, con il tuo consenso (vedi le sezioni dedicate).",
        "Google: solo se scegli di accedere con Google; agisce come titolare autonomo per l'autenticazione.",
        "Strumenti di monitoraggio, avvisi tecnici e statistiche anonime (Umami), che gestiamo sui nostri server e che non ricevono dati finanziari né contenuti tuoi.",
      ],
    },
    {
      id: "extra-ue",
      title: "Trasferimenti fuori dallo Spazio economico europeo",
      paragraphs: [
        "Cloudflare, Google, Resend e OpenRouter (con il fornitore del modello) sono società che possono trattare dati anche fuori dallo SEE (per esempio negli Stati Uniti). In questi casi il trasferimento avviene con una decisione di adeguatezza (EU-US Data Privacy Framework) o con le clausole contrattuali standard della Commissione europea.",
      ],
    },
    {
      id: "conservazione",
      title: "Per quanto tempo conserviamo i dati",
      items: [
        "Dati dell'account e dati finanziari: finché l'account esiste.",
        `Disattivazione: se disattivi l'account hai ${DEACTIVATION_DAYS} giorni per ripensarci, poi i dati vengono eliminati definitivamente. Puoi anche eliminare subito tutto da Impostazioni.`,
        `Inattività: se non accedi da ${INACTIVITY_DAYS} giorni l'account viene eliminato con tutti i suoi dati. Ti scriviamo all'indirizzo dell'account ${INACTIVITY_NOTICE_DAYS} giorni prima: un accesso, anche solo uno, annulla l'eliminazione.`,
        `Copie di sicurezza (backup): i dati eliminati restano nei backup per al più ${BACKUP_DAYS} giorni, poi spariscono con la rotazione.`,
        `Sessioni: scadono dopo ${SESSION_DAYS} giorni senza utilizzo e le sessioni scadute vengono cancellate. I link di accesso valgono ${MAGIC_LINK_MINUTES} minuti.`,
        `Import con intelligenza artificiale: file cancellato al termine dell'elaborazione, anteprima al massimo ${CSV_PREVIEW_DAYS} giorni, regole di lettura fino all'eliminazione dell'account.`,
        "Proposte di categoria: finché l'account esiste o fino al reset dei dati; revocando il consenso non partono nuove richieste.",
        `Registri tecnici (log): ${LOG_DAYS} giorni.`,
        `Messaggi al supporto: nella casella di posta del titolare, il tempo necessario a rispondere e comunque non oltre ${SUPPORT_MONTHS} mesi dalla chiusura della richiesta. Eliminando l'account non vengono cancellati in automatico: puoi chiederne la cancellazione scrivendo a ${LEGAL_OWNER.email}.`,
        `Email di riepilogo e avvisi: le preferenze finché l'account esiste; il registro degli invii (solo chiavi tecniche per non ripetere lo stesso avviso, senza importi) ${NOTIFICATION_LOG_DAYS} giorni.`,
        "Registro dell'accettazione dei Termini: finché l'account esiste.",
        "Statistiche d'uso anonime: non sono dati personali, quindi non hanno scadenza legata al tuo account.",
      ],
    },
    {
      id: "diritti",
      title: "I tuoi diritti",
      paragraphs: [
        "Hai diritto di accedere ai tuoi dati, correggerli, cancellarli, limitarne il trattamento, riceverli in formato portabile e opporti al trattamento basato sul legittimo interesse (artt. 15-22 GDPR). Dove il trattamento si basa sul consenso (l'import con intelligenza artificiale e le proposte di categoria) puoi revocarlo in qualsiasi momento, senza effetto sul trattamento già avvenuto.",
      ],
      items: [
        "Accesso e portabilità: in Impostazioni scarichi un archivio ZIP con tutti i tuoi dati in JSON e CSV.",
        "Cancellazione: in Impostazioni puoi disattivare o eliminare l'account e cancellare tutti i dati.",
        `Rettifica, limitazione, opposizione e ogni altra richiesta: scrivi a ${LEGAL_OWNER.email} (in Impostazioni → Privacy trovi i messaggi già pronti). Rispondiamo entro un mese, prorogabile di due in casi complessi, come previsto dall'art. 12 GDPR.`,
        "Reclamo: puoi rivolgerti al Garante per la protezione dei dati personali (garanteprivacy.it).",
      ],
    },
    {
      id: "obbligo",
      title: "Se non fornisci i dati",
      paragraphs: [
        "I dati dell'account (email) sono necessari per creare l'account e farti accedere; senza non possiamo fornire il servizio. Tutti gli altri dati li inserisci tu: se non li fornisci, le funzioni che ne hanno bisogno non sono utilizzabili.",
      ],
    },
    {
      id: "decisioni",
      title: "Decisioni automatizzate",
      paragraphs: [
        "BuddyBudget non prende decisioni che producano effetti giuridici su di te. La categorizzazione delle transazioni usa regole che puoi vedere e modificare, le tue scelte passate, la categoria scritta dalla tua banca nei file che importi e, se lo attivi, le proposte di un modello di intelligenza artificiale. La categoria della banca, quando corrisponde chiaramente a una delle tue, si applica da sola (senza intelligenza artificiale); se lo scegli, anche le proposte più sicure si applicano da sole: riguardano solo l'etichetta dei tuoi movimenti, sono sempre indicate come applicate automaticamente e puoi correggerle in ogni momento. Le stime fiscali, le proiezioni e le simulazioni sono strumenti informativi, non decisioni su di te.",
      ],
    },
    {
      id: "sicurezza",
      title: "Come proteggiamo i dati",
      paragraphs: [
        "Connessioni cifrate, accesso amministrativo limitato e protetto, nuova verifica dell'accesso prima di azioni sensibili (export, reset, eliminazione), log senza dati personali in chiaro, file di import cifrati e copie di sicurezza su un servizio che le cifra a riposo. Se un incidente dovesse esporre i tuoi dati in modo rischioso per te, lo notificheremo al Garante e a te nei tempi previsti dagli articoli 33 e 34 del GDPR.",
      ],
    },
    {
      id: "minori",
      title: "Minori",
      paragraphs: ["Il servizio è riservato a chi ha almeno 18 anni. Se scopriamo che un account appartiene a un minorenne lo eliminiamo."],
    },
    {
      id: "modifiche",
      title: "Modifiche a questa informativa",
      paragraphs: [
        `La versione in vigore è quella del ${LEGAL_VERSION}. Se cambia in modo sostanziale ti avvisiamo in app prima che la modifica si applichi.`,
      ],
    },
  ],
};

export const TERMINI: LegalDocument = {
  slug: "termini",
  title: "Termini di servizio",
  description: "Le regole d'uso di BuddyBudget: cosa è e cosa non è il servizio, cosa ti chiediamo e le nostre responsabilità.",
  intro:
    "Questi termini regolano l'uso di BuddyBudget. Creando un account dichiari di averli letti e di accettarli.",
  sections: [
    {
      id: "servizio",
      title: "Che cos'è BuddyBudget",
      paragraphs: [
        `BuddyBudget è un'applicazione di gestione finanziaria personale offerta da ${LEGAL_OWNER.name}, persona fisica (${LEGAL_OWNER.address}): raccoglie e organizza conti, spese, investimenti, debiti e pensione per darti un quadro del tuo patrimonio.`,
        "Per ora è gratuita e in versione beta: può cambiare, avere errori o essere interrotta, e non ci sono livelli di servizio garantiti. Se in futuro introduciamo piani a pagamento lo comunicheremo in anticipo.",
      ],
    },
    {
      id: "requisiti",
      title: "Chi può usarlo",
      paragraphs: [
        "Devi avere almeno 18 anni e usare il servizio per scopi personali, non per attività professionale o per gestire i dati di altri. Sei responsabile della riservatezza del tuo accesso e dei dati che inserisci.",
      ],
    },
    {
      id: "no-consulenza",
      title: "Non è consulenza finanziaria, fiscale o previdenziale",
      paragraphs: [
        "Calcoli, stime, simulazioni, grafici, stime fiscali, proiezioni pensionistiche e commenti sui titoli hanno solo scopo informativo e si basano sui dati che inserisci e su ipotesi semplificate. Non sono una raccomandazione di investimento né una consulenza personalizzata e BuddyBudget non è un intermediario finanziario. Le regole fiscali e previdenziali cambiano e dipendono dalla tua situazione: prima di decidere rivolgiti a un professionista abilitato.",
        "I prezzi di mercato provengono da fonti di terzi, possono essere in ritardo o errati e sono chiusure di fine giornata, non quotazioni in tempo reale. Lo stesso vale per i dati ricevuti dalle banche tramite i collegamenti Open Banking già attivi: dipendono dalla banca e dal fornitore del collegamento.",
        "L'import con intelligenza artificiale produce regole di lettura generate automaticamente: controlla che i movimenti importati corrispondano ai tuoi documenti. Le categorie messe dall'app (dalle tue regole, dalla categoria della banca nei file importati o dalle proposte più sicure, se lo hai scelto) possono essere sbagliate: le trovi indicate come messe dall'app, puoi cambiarle in ogni momento e sei tu a verificare che siano giuste.",
        "Le richieste all'intelligenza artificiale passano da OpenRouter solo verso fornitori che non conservano i dati e non li usano per l'addestramento (zero data retention, vedi l'informativa sulla privacy); se nessuno è disponibile la funzione non risponde e i tuoi dati restano come sono.",
      ],
    },
    {
      id: "uso",
      title: "Come ti chiediamo di usarlo",
      items: [
        "Inserisci solo dati che hai il diritto di usare e collega solo conti bancari di cui sei titolare.",
        "Non tentare di accedere ai dati di altri utenti, aggirare i limiti tecnici o sovraccaricare il servizio.",
        "Non estrarre dati dal servizio in modo automatico con strumenti non forniti da noi e non usare il servizio per attività illecite.",
        "Non caricare file contenenti virus o contenuti che violano la legge o diritti di altri.",
      ],
    },
    {
      id: "dati",
      title: "I tuoi dati",
      paragraphs: [
        "I dati che inserisci restano tuoi. Ci autorizzi a trattarli solo per fornirti il servizio, come spiegato nell'informativa sulla privacy. Puoi esportarli o eliminarli in qualunque momento da Impostazioni. Facciamo copie di sicurezza, ma ti consigliamo di scaricare ogni tanto un export: non garantiamo che ogni dato sia sempre recuperabile.",
      ],
    },
    {
      id: "codice",
      title: "Codice sorgente e licenza",
      paragraphs: [
        "Il codice di BuddyBudget è pubblicato con licenza GNU AGPL-3.0 e puoi usarlo secondo quella licenza. Questi termini regolano soltanto l'uso del servizio che gestiamo noi, non la licenza del codice.",
      ],
    },
    {
      id: "responsabilita",
      title: "Responsabilità",
      paragraphs: [
        "Il servizio è fornito \"così com'è\", senza garanzie di continuità o di assenza di errori. Nei limiti consentiti dalla legge, non rispondiamo di decisioni economiche prese sulla base delle informazioni mostrate, di errori o ritardi dei dati di terzi (banche, fornitori di prezzi, fonti fiscali) né di danni indiretti. Nulla in questi termini esclude responsabilità che la legge non permette di escludere, né i diritti che la legge riconosce ai consumatori.",
      ],
    },
    {
      id: "sospensione",
      title: "Sospensione e chiusura",
      paragraphs: [
        `Puoi chiudere l'account quando vuoi, da Impostazioni. Se non accedi per ${INACTIVITY_DAYS} giorni chiudiamo noi l'account ed eliminiamo i dati: ti avvisiamo via email ${INACTIVITY_NOTICE_DAYS} giorni prima e un accesso entro quella data annulla l'eliminazione. Possiamo sospendere o chiudere un account che violi questi termini o metta a rischio il servizio, dandoti notizia quando possibile. Possiamo anche interrompere il servizio, avvisandoti con un preavviso ragionevole e lasciandoti il tempo di esportare i dati.`,
      ],
    },
    {
      id: "modifiche",
      title: "Modifiche ai termini",
      paragraphs: [
        `La versione in vigore è quella del ${LEGAL_VERSION}. Se cambiano in modo sostanziale ti avvisiamo in app e ti chiediamo di accettare di nuovo; se non accetti puoi esportare i dati e chiudere l'account.`,
      ],
    },
    {
      id: "legge",
      title: "Legge applicabile, foro e contatti",
      paragraphs: [
        `Si applica la legge italiana, salve le norme inderogabili a tutela dei consumatori del tuo paese di residenza. Se agisci come consumatore, per le controversie è competente il giudice del luogo in cui risiedi o hai il domicilio; in tutti gli altri casi è competente il foro di Torino. Per domande scrivi a ${LEGAL_OWNER.email}.`,
      ],
    },
  ],
};

export const COOKIE: LegalDocument = {
  slug: "cookie",
  title: "Cookie e strumenti simili",
  description: "Quali cookie e dati salvati nel browser usano il sito e l'app BuddyBudget, e come disattivare le statistiche.",
  intro:
    "Il sito e l'app usano solo strumenti tecnici necessari al funzionamento e statistiche anonime senza cookie, aggregate e gestite da noi. Per questo non mostriamo un banner di consenso. Questa pagina soddisfa l'obbligo di informativa (art. 122 del Codice Privacy e Linee guida cookie del Garante del 10 giugno 2021).",
  sections: [
    {
      id: "tecnici",
      title: "Strumenti tecnici (non servono consenso)",
      items: [
        `Cookie di sessione dell'app (app.buddybudget.io): ti tiene collegato dopo l'accesso, scade dopo ${SESSION_DAYS} giorni senza utilizzo e sparisce all'uscita.`,
        "Cookie di sicurezza temporanei durante l'accesso (per esempio quando scegli Google), necessari a completarlo.",
        "Lingua e paese: un cookie dell'app ricorda la lingua scelta (un anno); sul sito un cookie di un giorno contiene solo il paese da cui ti colleghi, che Cloudflare ricava dall'indirizzo IP, e serve a proporti la lingua giusta e a non mostrarti funzioni che nel tuo paese non ci sono ancora. L'indirizzo IP non viene salvato; il sito ricorda nell'archivio locale la lingua che scegli.",
        "Archivio locale del browser: ricorda tema chiaro o scuro, stato della barra laterale, sezioni chiuse, scelta di nascondere gli importi, la scelta sulle statistiche e le preferenze delle schermate.",
        "Per farti rientrare più in fretta, l'app ricorda su quel dispositivo l'email dell'ultimo account entrato (nell'archivio locale) e il metodo usato per l'ultimo accesso (un cookie che dura 30 giorni). Restano solo nel tuo browser: \"Non sei tu?\" nella pagina di accesso li cancella.",
        "Questi strumenti servono a erogare ciò che chiedi: per i cookie tecnici il Garante (Linee guida, par. 5) richiede solo l'informativa e non il consenso.",
      ],
    },
    {
      id: "statistiche",
      title: "Statistiche d'uso anonime",
      paragraphs: [
        "Usiamo Umami, installato sui nostri server, per contare visite e azioni (per esempio \"transazione aggiunta\"). Non usa cookie, non ti segue su altri siti, vale per un solo sito alla volta e non riceve importi, nomi o testi tuoi. Non è condiviso con terzi. Serve solo a statistiche aggregate: per questo lo trattiamo come gli strumenti statistici che le Linee guida (par. 7.2) equiparano ai tecnici, senza consenso.",
        "Vuoi che le tue visite non vengano contate? Nell'app, in Impostazioni → Privacy, spegni \"Statistiche d'uso anonime\". Sul sito, e in generale, basta impostare nel browser il valore localStorage \"umami.disabled\" a \"1\" (localStorage.setItem(\"umami.disabled\", \"1\")). La scelta vale per il dispositivo e il sito in cui la fai.",
      ],
    },
    {
      id: "terzi",
      title: "Cookie di terze parti",
      paragraphs: [
        "Non usiamo cookie di profilazione, pubblicità o social. I caratteri tipografici sono serviti dal nostro dominio. Se accedi con Google, Google può impostare i propri cookie sulla sua pagina di accesso, che ha una propria informativa.",
      ],
    },
    {
      id: "modifiche",
      title: "Modifiche",
      paragraphs: [`Versione del ${LEGAL_VERSION}. Se aggiungiamo strumenti non tecnici chiederemo prima il tuo consenso.`],
    },
  ],
};

export const LEGAL_DOCUMENTS = [PRIVACY, TERMINI, COOKIE] as const;

/** Percorso pubblico di ciascun documento sulla landing. */
export const LEGAL_PATHS = { privacy: "/privacy", termini: "/termini", cookie: "/cookie" } as const;
