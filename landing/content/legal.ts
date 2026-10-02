/**
 * Testi legali pubblici (Privacy, Termini, Cookie). BOZZA: da far rivedere a un professionista prima del lancio
 * pubblico. Dati del titolare e versione stanno in `LEGAL_OWNER` / `LEGAL_VERSION`: la versione cambia ogni volta
 * che cambia un testo (serve a chiedere una nuova accettazione agli utenti, vedi piano GDPR).
 */

/** True finché i testi non sono stati rivisti: mostra l'avviso "bozza" in cima alle pagine e le toglie dall'indicizzazione. */
export const LEGAL_DRAFT = true;

/** Versione dei documenti (data dell'ultima modifica sostanziale). */
export const LEGAL_VERSION = "2026-10-02";

export const LEGAL_OWNER = {
  name: "Daniele Roccaforte",
  email: "privacy@buddybudget.io",
  /** Segnaposto: va sostituito con il domicilio del titolare prima della pubblicazione. */
  address: "[indirizzo del titolare, da completare]",
} as const;

/** Durate citate nell'informativa: tenerle allineate al codice e all'infrastruttura. */
const SESSION_DAYS = 7;
const MAGIC_LINK_MINUTES = 10;
const DEACTIVATION_DAYS = 30;
const BACKUP_DAYS = 14;
const BANK_CONSENT_DAYS = 90;

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
        `Per qualunque richiesta sulla privacy scrivi a ${LEGAL_OWNER.email}. Non è stato nominato un responsabile della protezione dei dati (DPO): non è obbligatorio per il livello attuale del trattamento.`,
      ],
    },
    {
      id: "dati",
      title: "Quali dati trattiamo",
      items: [
        "Dati dell'account: nome, indirizzo email, valuta e preferenze scelte. Se accedi con Google, anche la foto del profilo.",
        "Dati finanziari che inserisci tu o che importi: conti, saldi, transazioni (con descrizione, note e controparte), categorie, budget, investimenti, debiti, fondi pensione e patrimonio netto. Le descrizioni possono contenere informazioni su abitudini, acquisti o contesti personali: non ti chiediamo mai di inserire dati sulla salute, sulle opinioni o altre categorie particolari, ma possono emergere dai testi delle transazioni.",
        "Dati bancari: se colleghi un conto con Open Banking, tramite GoCardless riceviamo i conti e le transazioni che autorizzi. Non vediamo né conserviamo le credenziali della tua banca.",
        "Dati tecnici di accesso: data, indirizzo IP e tipo di dispositivo delle sessioni (visibili in Impostazioni), per proteggere l'account.",
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
        "Inviarti email di servizio (link di accesso, avvisi di scadenza del collegamento bancario, conferme di disattivazione): esecuzione del contratto, art. 6.1.b. Non inviamo email promozionali.",
        "Sicurezza, prevenzione degli abusi, diagnosi di errori e continuità del servizio (sessioni, log, backup): legittimo interesse, art. 6.1.f, bilanciato dal fatto che i log sono pseudonimizzati e di breve durata.",
        "Capire quali funzioni vengono usate per migliorare il prodotto, con statistiche anonime: legittimo interesse, art. 6.1.f. Puoi disattivarle in qualunque momento (vedi la pagina sui cookie).",
        "Rispettare obblighi di legge, se e quando applicabili: art. 6.1.c.",
      ],
    },
    {
      id: "open-banking",
      title: "Collegamento bancario (Open Banking)",
      paragraphs: [
        `Il collegamento passa da GoCardless Bank Account Data, un fornitore di servizi di informazione sui conti autorizzato ai sensi della direttiva PSD2. Autorizzi l'accesso direttamente presso la tua banca; l'autorizzazione dura al massimo ${BANK_CONSENT_DAYS} giorni, dopo i quali va rinnovata, e puoi revocarla quando vuoi.`,
        "Il consenso che dai alla tua banca e a GoCardless è distinto da questa informativa. Se elimini l'account o fai il reset dei dati revochiamo i collegamenti attivi presso GoCardless.",
      ],
    },
    {
      id: "destinatari",
      title: "Con chi condividiamo i dati",
      paragraphs: [
        "Non vendiamo i tuoi dati e non li usiamo per pubblicità. Li comunichiamo solo ai fornitori che servono a far funzionare il servizio, nominati responsabili del trattamento o, dove agiscono come titolari autonomi, indicati come tali:",
      ],
      items: [
        "Hostinger: server (VPS) in Germania, dove girano app e database.",
        "Cloudflare: instradamento del traffico, DNS, sito pubblico e archiviazione dei backup cifrati del database.",
        "GoCardless: lettura dei conti bancari che colleghi, ai sensi di PSD2.",
        "Resend: invio delle email di servizio (usa il tuo indirizzo email).",
        "Google: solo se scegli di accedere con Google; agisce come titolare autonomo per l'autenticazione.",
        "Strumenti interni di monitoraggio e avvisi tecnici, che non ricevono dati personali tuoi.",
      ],
    },
    {
      id: "extra-ue",
      title: "Trasferimenti fuori dallo Spazio economico europeo",
      paragraphs: [
        "Cloudflare, Google e Resend sono società che possono trattare dati anche fuori dallo SEE (per esempio negli Stati Uniti). In questi casi il trasferimento avviene con una decisione di adeguatezza (EU-US Data Privacy Framework) o con le clausole contrattuali standard della Commissione europea.",
      ],
    },
    {
      id: "conservazione",
      title: "Per quanto tempo conserviamo i dati",
      items: [
        "Dati dell'account e dati finanziari: finché l'account esiste.",
        `Disattivazione: se disattivi l'account hai ${DEACTIVATION_DAYS} giorni per ripensarci, poi i dati vengono eliminati definitivamente. Puoi anche eliminare subito tutto da Impostazioni.`,
        `Copie di sicurezza (backup): i dati eliminati restano nei backup cifrati per al più ${BACKUP_DAYS} giorni, poi spariscono con la rotazione.`,
        `Sessioni: scadono dopo ${SESSION_DAYS} giorni senza utilizzo. I link di accesso valgono ${MAGIC_LINK_MINUTES} minuti.`,
        "Registri tecnici (log): per un periodo breve, definito e documentato internamente [durata da confermare prima della pubblicazione].",
        "Statistiche d'uso anonime: non sono dati personali, quindi non hanno scadenza legata al tuo account.",
      ],
    },
    {
      id: "diritti",
      title: "I tuoi diritti",
      paragraphs: [
        "Hai diritto di accedere ai tuoi dati, correggerli, cancellarli, limitarne il trattamento, riceverli in formato portabile e opporti al trattamento basato sul legittimo interesse (artt. 15-22 GDPR).",
      ],
      items: [
        "Accesso e portabilità: in Impostazioni scarichi un archivio ZIP con tutti i tuoi dati in JSON e CSV.",
        "Cancellazione: in Impostazioni puoi disattivare o eliminare l'account e cancellare tutti i dati.",
        "Rettifica, limitazione, opposizione e ogni altra richiesta: scrivi a " + LEGAL_OWNER.email + ". Rispondiamo entro un mese.",
        "Reclamo: puoi rivolgerti al Garante per la protezione dei dati personali (garanteprivacy.it).",
      ],
    },
    {
      id: "decisioni",
      title: "Decisioni automatizzate",
      paragraphs: [
        "BuddyBudget non prende decisioni che producano effetti giuridici su di te. La categorizzazione delle transazioni usa regole che puoi vedere e modificare e propone soluzioni che confermi tu.",
      ],
    },
    {
      id: "sicurezza",
      title: "Come proteggiamo i dati",
      paragraphs: [
        "Connessioni cifrate, accesso amministrativo limitato e protetto, nuova verifica dell'accesso prima di azioni sensibili (export, reset, eliminazione), log senza dati personali in chiaro e backup cifrati. Se un incidente dovesse esporre i tuoi dati in modo rischioso per te, lo notificheremo al Garante e a te nei tempi previsti dagli articoli 33 e 34 del GDPR.",
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
        `BuddyBudget è un'applicazione di gestione finanziaria personale offerta da ${LEGAL_OWNER.name}: raccoglie e organizza conti, spese, investimenti, debiti e pensione per darti un quadro del tuo patrimonio. Per ora è gratuita e in versione beta: può cambiare, avere errori o essere interrotta.`,
      ],
    },
    {
      id: "requisiti",
      title: "Chi può usarlo",
      paragraphs: [
        "Devi avere almeno 18 anni e usare il servizio per scopi personali. Sei responsabile della riservatezza del tuo accesso e dei dati che inserisci.",
      ],
    },
    {
      id: "no-consulenza",
      title: "Non è consulenza finanziaria, fiscale o previdenziale",
      paragraphs: [
        "Calcoli, stime, simulazioni, grafici, stime fiscali, proiezioni pensionistiche e commenti sui titoli hanno solo scopo informativo e si basano sui dati che inserisci e su ipotesi semplificate. Non sono una raccomandazione di investimento né una consulenza personalizzata. Le regole fiscali e previdenziali cambiano e dipendono dalla tua situazione: prima di decidere rivolgiti a un professionista abilitato.",
        "I prezzi di mercato provengono da fonti di terzi, possono essere in ritardo o errati e sono chiusure di fine giornata, non quotazioni in tempo reale.",
      ],
    },
    {
      id: "uso",
      title: "Come ti chiediamo di usarlo",
      items: [
        "Inserisci solo dati che hai il diritto di usare e collega solo conti bancari di cui sei titolare.",
        "Non tentare di accedere ai dati di altri utenti, aggirare i limiti tecnici o sovraccaricare il servizio.",
        "Non usare il servizio per attività illecite.",
      ],
    },
    {
      id: "dati",
      title: "I tuoi dati",
      paragraphs: [
        "I dati che inserisci restano tuoi. Puoi esportarli o eliminarli in qualunque momento da Impostazioni. Come li trattiamo è spiegato nell'informativa sulla privacy.",
      ],
    },
    {
      id: "responsabilita",
      title: "Responsabilità",
      paragraphs: [
        "Il servizio è fornito \"così com'è\", senza garanzie di continuità o di assenza di errori. Nei limiti consentiti dalla legge, non rispondiamo di decisioni economiche prese sulla base delle informazioni mostrate né di danni indiretti. Nulla in questi termini esclude responsabilità che la legge non permette di escludere, né i diritti che la legge riconosce ai consumatori.",
      ],
    },
    {
      id: "sospensione",
      title: "Sospensione e chiusura",
      paragraphs: [
        "Puoi chiudere l'account quando vuoi. Possiamo sospendere o chiudere un account che violi questi termini o metta a rischio il servizio, dandoti notizia quando possibile. Possiamo anche interrompere il servizio, avvisandoti con un preavviso ragionevole e lasciandoti il tempo di esportare i dati.",
      ],
    },
    {
      id: "modifiche",
      title: "Modifiche ai termini",
      paragraphs: [
        `La versione in vigore è quella del ${LEGAL_VERSION}. Se cambiano in modo sostanziale ti avvisiamo in app e ti chiediamo di accettare di nuovo.`,
      ],
    },
    {
      id: "legge",
      title: "Legge applicabile e contatti",
      paragraphs: [
        `Si applica la legge italiana, salve le norme inderogabili a tutela dei consumatori del tuo paese di residenza. Per domande scrivi a ${LEGAL_OWNER.email}.`,
      ],
    },
  ],
};

export const COOKIE: LegalDocument = {
  slug: "cookie",
  title: "Cookie e strumenti simili",
  description: "Quali cookie e dati salvati nel browser usano il sito e l'app BuddyBudget, e come disattivare le statistiche.",
  intro:
    "Il sito e l'app usano solo strumenti tecnici necessari al funzionamento e statistiche anonime senza cookie. Per questo non mostriamo un banner di consenso. Questa pagina soddisfa l'obbligo di informativa (art. 122 del Codice Privacy e linee guida del Garante del 10 giugno 2021).",
  sections: [
    {
      id: "tecnici",
      title: "Strumenti tecnici (non servono consenso)",
      items: [
        "Cookie di sessione dell'app (app.buddybudget.io): ti tiene collegato dopo l'accesso, scade dopo 7 giorni senza utilizzo.",
        "Archivio locale del browser: ricorda tema chiaro o scuro, stato della barra laterale, sezioni chiuse, scelta di nascondere gli importi e le preferenze delle schermate.",
      ],
    },
    {
      id: "statistiche",
      title: "Statistiche d'uso anonime",
      paragraphs: [
        "Usiamo Umami, installato sui nostri server, per contare visite e azioni (per esempio \"transazione aggiunta\"). Non usa cookie, non ti segue su altri siti e non riceve importi, nomi o testi tuoi. Non è condiviso con terzi.",
        "Vuoi che le tue visite non vengano contate? Apri la console del browser e imposta localStorage.setItem(\"umami.disabled\", \"1\"); un interruttore dedicato in Impostazioni arriverà con un prossimo aggiornamento.",
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
