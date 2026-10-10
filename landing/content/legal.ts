/**
 * Testi legali pubblici (Privacy, Termini, Cookie). Dati del titolare e versione stanno in `LEGAL_OWNER` / `LEGAL_VERSION`:
 * la versione cambia ogni volta che cambia un testo in modo sostanziale (serve a chiedere una nuova accettazione agli utenti).
 * Non sono un parere legale: restano da far rivedere a un professionista.
 */

/** Versione dei documenti (data dell'ultima modifica sostanziale). */
export const LEGAL_VERSION = "2026-10-10";

export const LEGAL_OWNER = {
  name: "Daniele Roccaforte",
  email: "privacy@buddybudget.io",
  address: "via Lancia 62, 10141 Torino (TO), Italia",
} as const;

/** Durate citate nell'informativa: tenerle allineate al codice e all'infrastruttura. */
const SESSION_DAYS = 7;
const MAGIC_LINK_MINUTES = 10;
const DEACTIVATION_DAYS = 30;
const BACKUP_DAYS = 14;
const BANK_CONSENT_DAYS = 90;
/** Retention di Loki nel repo infra (`limits_config.retention_period`). */
const LOG_DAYS = 30;
/** Anteprima cifrata di un import CSV con AI (`expiresAt` in lib/personal-import/jobs.ts). */
const CSV_PREVIEW_DAYS = 7;
/** Registro degli invii delle email di riepilogo e avviso (`NOTIFICATION_LOG_RETENTION_DAYS` nell'app). */
const NOTIFICATION_LOG_DAYS = 90;

/** Segnalazioni al supporto: tempo massimo di conservazione dopo la chiusura. */
const SUPPORT_MONTHS = 12;

export interface LegalSection {
  id: string;
  title: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
}

export interface LegalDocument {
  slug: "privacy" | "termini" | "cookie";
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
        "Dati finanziari che inserisci tu o che importi: conti, saldi, transazioni (con descrizione, note e controparte), categorie, budget, investimenti, debiti, fondi pensione e patrimonio netto. Le descrizioni possono contenere informazioni su abitudini, acquisti o contesti personali: non ti chiediamo mai di inserire dati sulla salute, sulle opinioni o altre categorie particolari, ma possono emergere dai testi delle transazioni.",
        "Dati bancari: se colleghi un conto con Open Banking, tramite GoCardless riceviamo i conti e le transazioni che autorizzi. Non vediamo né conserviamo le credenziali della tua banca.",
        "File che carichi per l'import: estratti conto e rendiconti (per esempio CSV o file dei broker). Se scegli l'import con intelligenza artificiale, il file viene conservato cifrato solo per il tempo dell'elaborazione (vedi la sezione dedicata).",
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
        "Fornirti il servizio (account, conti, transazioni, investimenti, debiti, pensione, import e sincronizzazione bancaria, export dei dati): esecuzione del contratto, art. 6.1.b.",
        "Inviarti email di servizio (link di accesso, avvisi di scadenza del collegamento bancario, esito degli import, conferme di disattivazione): esecuzione del contratto, art. 6.1.b. Queste email non si possono disattivare perché servono a usare l'account.",
        "Inviarti, solo se li attivi in Impostazioni → Notifiche, il riepilogo periodico (con le cifre di entrate, spese e budget che vedi già nell'app) e gli avvisi sui budget e sulle rate in scadenza: il tuo consenso, art. 6.1.a. Sono spenti finché non li scegli, ogni email ha il link per disattivarla con un clic (senza accedere) e puoi cambiare idea quando vuoi. Non inviamo email promozionali né consigli personalizzati.",
        "Analizzare con l'intelligenza artificiale un file di import non riconosciuto: il tuo consenso esplicito, art. 6.1.a, che dai prima di caricare il file e puoi non dare usando gli altri tipi di import o l'inserimento manuale. Il consenso non è condizione per usare il resto del servizio.",
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
        `Il collegamento passa da GoCardless Bank Account Data, un fornitore di servizi di informazione sui conti autorizzato ai sensi della direttiva PSD2. Autorizzi l'accesso direttamente presso la tua banca; l'autorizzazione dura al massimo ${BANK_CONSENT_DAYS} giorni, dopo i quali va rinnovata, e puoi revocarla quando vuoi.`,
        "Il consenso che dai alla tua banca e a GoCardless è distinto da questa informativa. Se elimini l'account o fai il reset dei dati revochiamo i collegamenti attivi presso GoCardless. Possiamo rimuovere da GoCardless anche i collegamenti scaduti o non più usati.",
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
      id: "destinatari",
      title: "Con chi condividiamo i dati",
      paragraphs: [
        "Non vendiamo i tuoi dati e non li usiamo per pubblicità. Li comunichiamo solo ai fornitori che servono a far funzionare il servizio, nominati responsabili del trattamento o, dove agiscono come titolari autonomi, indicati come tali. I servizi di prezzi, cambi e loghi degli strumenti sono interrogati dai nostri server con soli simboli, codici ISIN o nomi di titoli, mai con dati che ti identificano. Possiamo comunicare dati alle autorità quando la legge lo impone. I fornitori sono:",
      ],
      items: [
        "Hostinger: server (VPS) in Germania, dove girano app e database.",
        "Cloudflare: instradamento del traffico, DNS e archiviazione (R2) delle copie di sicurezza del database.",
        "GoCardless: lettura dei conti bancari che colleghi, ai sensi di PSD2.",
        "Resend: invio delle email di servizio e, se le attivi, di riepilogo e avvisi (usa il tuo indirizzo email e il testo delle email, che può contenere cifre del tuo budget) e consegna dei messaggi che scrivi al supporto.",
        "OpenRouter e il fornitore del modello che questo seleziona: solo se usi l'import con intelligenza artificiale, con il tuo consenso (vedi la sezione dedicata).",
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
        `Copie di sicurezza (backup): i dati eliminati restano nei backup per al più ${BACKUP_DAYS} giorni, poi spariscono con la rotazione.`,
        `Sessioni: scadono dopo ${SESSION_DAYS} giorni senza utilizzo e le sessioni scadute vengono cancellate. I link di accesso valgono ${MAGIC_LINK_MINUTES} minuti.`,
        `Import con intelligenza artificiale: file cancellato al termine dell'elaborazione, anteprima al massimo ${CSV_PREVIEW_DAYS} giorni, regole di lettura fino all'eliminazione dell'account.`,
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
        "Hai diritto di accedere ai tuoi dati, correggerli, cancellarli, limitarne il trattamento, riceverli in formato portabile e opporti al trattamento basato sul legittimo interesse (artt. 15-22 GDPR). Dove il trattamento si basa sul consenso (l'import con intelligenza artificiale) puoi revocarlo in qualsiasi momento, senza effetto sul trattamento già avvenuto.",
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
        "BuddyBudget non prende decisioni che producano effetti giuridici su di te. La categorizzazione delle transazioni usa regole che puoi vedere e modificare e propone soluzioni che confermi tu. Le stime fiscali, le proiezioni e le simulazioni sono strumenti informativi, non decisioni su di te.",
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
        "I prezzi di mercato provengono da fonti di terzi, possono essere in ritardo o errati e sono chiusure di fine giornata, non quotazioni in tempo reale. Lo stesso vale per i dati ricevuti dalle banche tramite Open Banking: dipendono dalla banca e dal fornitore del collegamento.",
        "L'import con intelligenza artificiale produce regole di lettura generate automaticamente: controlla che i movimenti importati corrispondano ai tuoi documenti.",
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
        "Puoi chiudere l'account quando vuoi, da Impostazioni. Possiamo sospendere o chiudere un account che violi questi termini o metta a rischio il servizio, dandoti notizia quando possibile. Possiamo anche interrompere il servizio, avvisandoti con un preavviso ragionevole e lasciandoti il tempo di esportare i dati.",
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
        "Archivio locale del browser: ricorda tema chiaro o scuro, stato della barra laterale, sezioni chiuse, scelta di nascondere gli importi, la scelta sulle statistiche e le preferenze delle schermate.",
        "Questi strumenti servono a erogare ciò che chiedi: per i cookie tecnici il Garante (Linee guida, par. 5) richiede solo l'informativa e non il consenso.",
      ],
    },
    {
      id: "statistiche",
      title: "Statistiche d'uso anonime",
      paragraphs: [
        "Usiamo Umami, installato sui nostri server, per contare visite e azioni (per esempio \"transazione aggiunta\"). Non usa cookie, non ti segue su altri siti, vale per un solo sito alla volta e non riceve importi, nomi o testi tuoi. Non è condiviso con terzi. Serve solo a statistiche aggregate: per questo lo trattiamo come gli strumenti statistici che le Linee guida (par. 7.2) equiparano ai tecnici, senza consenso.",
        "Vuoi che le tue visite non vengano contate? Nell'app, in Impostazioni → Preferenze, spegni \"Statistiche d'uso anonime\". Sul sito, e in generale, basta impostare nel browser il valore localStorage \"umami.disabled\" a \"1\" (localStorage.setItem(\"umami.disabled\", \"1\")). La scelta vale per il dispositivo e il sito in cui la fai.",
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
