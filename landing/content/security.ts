/**
 * Testi della pagina «Sicurezza e privacy» (`/sicurezza`). Ogni frase è verificata nel codice dell'app, nel repo infra o
 * in una fonte ufficiale citata in `SECURITY_SOURCES` (controllo del 2026-10-12). Prima di aggiungere una promessa,
 * cercarne la prova: quello che non si può dimostrare (cifratura del disco, audit, certificazioni) non va scritto.
 */
import type { Locale } from "@/lib/i18n";
import { LEGAL_OWNER, LEGAL_PATHS } from "./legal";
import type { Source } from "./seo-pages";

/** Giorni di validità del consenso alla banca (`access_valid_for_days` in `lib/gocardless/connection-health.ts`). */
const BANK_CONSENT_DAYS = 90;
/** Retention di Loki nel repo infra. */
const LOG_DAYS = 30;
/** `retentionPolicy` dei backup CNPG nel repo infra. */
const BACKUP_DAYS = 14;
/** Minuti entro cui serve un accesso recente per export, reset ed eliminazione (`lib/auth`). */
const FRESH_LOGIN_MINUTES = 10;

export const SECURITY_SOURCES_CHECKED = "12 ottobre 2026";

/**
 * Vero solo quando in produzione `DATA_ENCRYPTION_KEY` è attiva E il job `encrypt-fields` ha cifrato i dati vecchi
 * (runbook `cifratura-dati.md` nel repo infra: la prova deve dire «0 in chiaro» su tutte le colonne). Finché è false la
 * landing non parla di cifratura nel database, perché non sarebbe ancora vero.
 */
export const FIELD_ENCRYPTION_LIVE = true;

/** Cosa cifra l'app nel database (colonne `encryptedText` nel repo dell'app). */
const ENCRYPTED_FIELDS_TEXT = "descrizioni e note dei movimenti, note di debiti e investimenti";

/** Fonti ufficiali citate nella pagina. */
export const SECURITY_SOURCES = {
  psd2: { label: "Direttiva (UE) 2015/2366 (PSD2), art. 67: il servizio di informazione sui conti accede solo con il consenso esplicito e solo ai dati dei conti indicati", href: "https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32015L2366" },
  rts: { label: "Regolamento delegato (UE) 2018/389: autenticazione forte del cliente e comunicazione sicura con la banca", href: "https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32018R0389" },
  gocardlessTerms: { label: "GoCardless, condizioni del servizio Bank Account Data (UE): GoCardless SAS, autorizzata dall'ACPR, n. 17118; cosa conserva e per cosa lo usa (art. 4.1), nessun altro terzo e credenziali mai viste (art. 4.3)", href: "https://gocardless.com/legal/bank-account-data/" },
  gocardlessPrivacy: { label: "GoCardless, informativa privacy per chi condivide i dati del proprio conto: dati raccolti e contatti del responsabile della protezione dei dati", href: "https://gocardless.com/privacy/account-holders/" },
  gocardlessPrivacyDetails: { label: "GoCardless, dettagli dell'informativa privacy: per quanto tempo conserva i dati, condivisione con le autorità e trasferimenti fuori dall'UE", href: "https://gocardless.com/privacy/details/" },
  regafi: { label: "REGAFI, registro degli intermediari autorizzati in Francia (ACPR): cerca GoCardless SAS", href: "https://www.regafi.fr/" },
  ebaRegister: { label: "EBA, registro europeo degli istituti di pagamento", href: "https://www.eba.europa.eu/risk-and-data-analysis/data/registers/payment-institutions-register" },
  gdpr: { label: "Regolamento (UE) 2016/679 (GDPR): diritti di accesso, portabilità e cancellazione (artt. 15-20)", href: "https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32016R0679" },
  r2Security: { label: "Cloudflare R2, sicurezza dei dati: gli oggetti sono cifrati a riposo", href: "https://developers.cloudflare.com/r2/reference/data-security/" },
  r2Location: { label: "Cloudflare R2, giurisdizione UE: i dati restano nell'Unione europea", href: "https://developers.cloudflare.com/r2/reference/data-location/" },
  garante: { label: "Garante per la protezione dei dati personali: come presentare un reclamo", href: "https://www.garanteprivacy.it/" },
} as const satisfies Record<string, Source>;

export type FlowNodeId = "tu" | "banca" | "gocardless" | "buddybudget";

export interface FlowNode {
  id: FlowNodeId;
  /** Etichetta breve nel diagramma. */
  label: string;
  /** Riga sotto l'etichetta. */
  role: string;
  /** Cosa vede o riceve questo passaggio. */
  sees: readonly string[];
  /** Cosa non vede mai. */
  never: readonly string[];
}

/** Texts of the data path (`DataPath`), in one language. */
export interface FlowContent {
  title: string;
  lede: string;
  /** What travels from each step to the next, in the order of the nodes. */
  links: readonly string[];
  nodes: readonly FlowNode[];
  /** Word that opens the «never» sentence of each step. */
  neverTitle: string;
}

/** The data path when you connect a bank, step by step. */
export const FLOW = {
  title: "Il percorso, passo per passo.",
  lede: "Le credenziali restano alla banca. Verso BuddyBudget arrivano solo saldi e movimenti, in sola lettura.",
  /** Cosa viaggia su ogni collegamento, nell'ordine dei nodi. */
  links: ["Credenziali e conferma", "Consenso in sola lettura", "Saldi e movimenti"],
  neverTitle: "Mai.",
  nodes: [
    {
      id: "tu",
      label: "Tu",
      role: "Scegli la banca nell'app",
      sees: ["Scegli quale banca collegare e quali conti condividere.", "Puoi scollegare la banca quando vuoi, dall'app o dalla tua banca."],
      never: ["Non devi mai dare a BuddyBudget nome utente, password o codici della banca."],
    },
    {
      id: "banca",
      label: "La tua banca",
      role: "Dove inserisci le credenziali",
      sees: ["Ti identifica con le sue credenziali e una conferma in più (autenticazione forte), come quando entri nell'home banking.", `Ti chiede di autorizzare la lettura dei conti per al massimo ${BANK_CONSENT_DAYS} giorni.`],
      never: ["Non ricevono le tue credenziali né GoCardless né BuddyBudget: le scrivi solo nelle pagine della banca."],
    },
    {
      id: "gocardless",
      label: "GoCardless",
      role: "Fornitore autorizzato (PSD2)",
      sees: ["GoCardless SAS è autorizzata dall'autorità francese di vigilanza (ACPR, n. 17118) a fornire servizi di informazione sui conti.", "Riceve dalla banca saldi, dati del conto e movimenti e li passa a BuddyBudget, perché l'hai chiesto tu. Ne conserva una copia secondo le sue condizioni e gli obblighi di legge."],
      never: ["Non vede le tue credenziali e non può muovere denaro: il servizio è solo di lettura."],
    },
    {
      id: "buddybudget",
      label: "BuddyBudget",
      role: "Server in Germania",
      sees: ["Chiede soltanto saldi, dati del conto e movimenti: nel codice non esiste nessuna funzione di pagamento.", FIELD_ENCRYPTION_LIVE
          ? "Salva saldi e movimenti per mostrarteli e calcolare budget e patrimonio; descrizioni e note le cifra prima di salvarle."
          : "Salva saldi e movimenti (data, importo, descrizione) per mostrarteli e calcolare budget e patrimonio.", "L'IBAN serve solo a farti scegliere il conto e non viene salvato."],
      never: ["Non vende i dati, non fa pubblicità e non li usa per profilarti."],
    },
  ] satisfies readonly FlowNode[],
} as const satisfies FlowContent;

export interface StoredRow {
  what: string;
  /** "no" = mai salvato; "si" = salvato; "parziale" = salvato con limiti. */
  kept: "no" | "si" | "parziale";
  keptLabel: string;
  detail: string;
}

/** What we keep and what never reaches us, one row per kind of data. */
export const STORED = {
  title: "Cosa teniamo, e cosa non arriva mai.",
  rows: [
    { what: "Credenziali della banca", kept: "no", keptLabel: "Mai", detail: "Restano alla banca: le inserisci solo nelle sue pagine." },
    { what: "Password", kept: "no", keptLabel: "Mai", detail: "Non esistono: entri con un link via email, valido pochi minuti, o con Google." },
    { what: "IBAN", kept: "no", keptLabel: "No", detail: "Usato solo mentre scegli quale conto collegare." },
    {
      what: "Saldi e movimenti",
      kept: "si",
      keptLabel: "Sì",
      detail: FIELD_ENCRYPTION_LIVE
        ? "Su un server in Germania, finché tieni il conto. Descrizioni e note sono cifrate (AES-256) prima di finire nel database; importi e date no, servono ai calcoli. Scollegando la banca si cancellano i movimenti di quel conto."
        : "Su un server in Germania, finché tieni il conto. Scollegando la banca si cancellano i movimenti di quel conto.",
    },
    { what: "Log tecnici", kept: "parziale", keptLabel: `${LOG_DAYS} giorni`, detail: "Senza email, nomi, importi né descrizioni: l'utente compare solo come un codice non reversibile." },
    { what: "Copie di sicurezza", kept: "parziale", keptLabel: `${BACKUP_DAYS} giorni`, detail: FIELD_ENCRYPTION_LIVE
      ? "Su Cloudflare R2 nell'Unione europea, cifrate a riposo dal servizio. Descrizioni e note restano cifrate anche lì, e la chiave non sta nei backup. Dopo 14 giorni i dati eliminati spariscono anche da lì."
      : "Su Cloudflare R2 nell'Unione europea, cifrate a riposo dal servizio. Dopo 14 giorni i dati eliminati spariscono anche da lì." },
    { what: "Statistiche d'uso", kept: "parziale", keptLabel: "Anonime", detail: "Pagine viste e azioni, senza importi né testi tuoi. Umami sui nostri server, senza cookie: dettagli più sotto." },
  ] satisfies readonly StoredRow[],
} as const;

export interface FactRow {
  label: string;
  text: string;
}

/** Cosa conserva GoCardless: dalle sue condizioni UE (art. 4) e dalla sua informativa privacy, non da ipotesi nostre. */
export const GOCARDLESS_DATA = {
  question: "Cosa conserva GoCardless, e per quanto?",
  lede: "GoCardless non è un semplice tramite: è un istituto autorizzato con obblighi propri e una sua informativa privacy. Ecco cosa dicono le sue condizioni.",
  rows: [
    { label: "Cosa conserva", text: "Nome dell'intestatario, dati e numero del conto, saldo e movimenti del periodo che autorizzi (condizioni UE, art. 4.1). Le credenziali della banca no: non le vede mai (art. 4.3)." },
    { label: "Per cosa li usa", text: "Solo per fornire il servizio. Le condizioni citano anche la prevenzione delle frodi sui tuoi conti e analisi interne per migliorare il servizio (art. 4.1)." },
    { label: "Con chi li condivide", text: "Con BuddyBudget, perché l'hai chiesto tu, e con nessun altro terzo (art. 4.3). Come ogni istituto regolato, deve consegnarli alle autorità quando la legge lo impone." },
    { label: "Per quanto tempo", text: "Finché servono al servizio, e più a lungo quando lo richiedono un obbligo di legge, una contestazione o la prevenzione delle frodi. I tempi variano per tipo di dato e GoCardless non pubblica un numero di anni." },
    { label: "Dove", text: "GoCardless SAS ha sede a Parigi. Alcuni suoi fornitori sono fuori dall'UE, anche negli Stati Uniti, con contratti che li obbligano a trattare i dati come richiede la legge europea." },
    { label: "Se scolleghi la banca", text: "Revochiamo il consenso e GoCardless smette di leggere i tuoi conti. Quello che ha già ricevuto segue i suoi tempi: per vederlo o chiederne la cancellazione puoi scrivere a GoCardless (GDPR, artt. 15-17)." },
  ] satisfies readonly FactRow[],
} as const;

/** Statistiche d'uso (Umami): cosa contiamo e cosa no. Vedi `lib/analytics/track.ts` (tipo chiuso `ProductEvents`) e la pagina cookie. */
export const ANALYTICS_DATA = {
  question: "Cosa contano le statistiche d'uso?",
  lede: "Usiamo le statistiche per sapere quali funzioni vengono usate e dove le persone si fermano. Non servono a conoscerti.",
  rows: [
    { label: "Cosa contiamo", text: "Pagine viste e azioni come «conto creato» o «file importato», con dettagli solo a categorie o conteggi (per esempio quanti conti hai collegato)." },
    { label: "Cosa non riceve mai", text: "Importi, descrizioni dei movimenti, nomi di esercenti, email, nomi o codici dei tuoi conti. L'elenco degli eventi è chiuso nel codice: un evento nuovo va aggiunto lì apposta." },
    { label: "Dove", text: "Umami, installato sui nostri server. Non usa cookie, non ti segue su altri siti e non passa i dati a terzi." },
    { label: "Come spegnerle", text: "Nell'app, da Impostazioni → Privacy, su ogni dispositivo." },
  ] satisfies readonly FactRow[],
} as const;

/**
 * Where the app uses AI and what it sends: the same three places as «Dove l'app usa l'AI» in the app's Settings
 * (`components/domain/settings/ai-usage-summary.tsx`) and the request in `lib/llm/jev.ts` (merchant name, direction,
 * categories; `zdr: true`, `data_collection: "deny"`).
 */
export const AI_DATA = {
  question: "Dove entra l'AI, e cosa vede?",
  lede: "L'AI è spenta finché non dici sì. Calcoli, regole, sincronizzazione con la banca e avvisi non la usano mai.",
  rows: [
    { label: "Quando", text: "Solo in tre punti: le proposte di categoria, l'importazione di un estratto conto in un formato nuovo e l'importazione degli investimenti quando la lettura normale non riesce." },
    { label: "Cosa riceve", text: "Per le categorie, il nome pulito dell'esercente, se è un'entrata o un'uscita, le tue categorie e le tue istruzioni: mai importi, date, IBAN, note o nomi di persone. Per un'importazione, il file intero, perché deve capire com'è fatto." },
    { label: "A chi va", text: "A OpenRouter, che passa la richiesta a un fornitore del modello. A ogni richiesta chiediamo un fornitore che non conservi i dati dopo la risposta e non li usi per l'addestramento; se nessuno lo garantisce, la richiesta non parte." },
    { label: "Cosa decide", text: "Propone, non comanda. Le tue regole vengono prima. Se lasci attiva l'opzione, si applicano da sole solo le proposte sicure almeno al 70%, segnate come messe dall'app e correggibili." },
    { label: "Il limite", text: "La non conservazione è una condizione che chiediamo a OpenRouter a ogni richiesta, non un contratto firmato con i fornitori dei modelli." },
    { label: "Come spegnerla", text: "Da Impostazioni revochi il consenso quando vuoi: da lì non parte più nessuna richiesta. Chi installa BuddyBudget sul proprio server può non configurare affatto l'AI: l'app funziona lo stesso." },
  ] satisfies readonly FactRow[],
} as const;

export interface Pillar {
  title: string;
  text: string;
}

/** Come si protegge l'accesso e come si tolgono i dati. */
export const CONTROLS = {
  title: "Porti via o cancelli tutto.",
  items: [
    { title: "Scollega la banca", text: "Togliendo l'ultimo conto di una banca revochiamo subito il consenso su GoCardless. Il consenso scade comunque dopo 90 giorni e lo rinnovi solo se vuoi." },
    { title: "Scarica i tuoi dati", text: "Da Impostazioni scarichi un file ZIP con tutto, in JSON e CSV." },
    { title: "Elimina l'account", text: "Subito, oppure con 30 giorni per ripensarci. Con l'account si chiudono anche i collegamenti alle banche." },
    { title: "Conferma prima delle azioni delicate", text: `Export, azzeramento ed eliminazione chiedono un accesso fatto negli ultimi ${FRESH_LOGIN_MINUTES} minuti, e per cancellare devi scrivere una conferma.` },
  ] satisfies readonly Pillar[],
} as const;

/** Cosa non promettiamo: limiti detti apertamente, perché la fiducia si regge anche su quello che non si dice. */
export const LIMITS = {
  title: "Quello che non promettiamo.",
  items: [
    {
      title: "Non è cifrato end-to-end",
      text: FIELD_ENCRYPTION_LIVE
        ? `Cifriamo nel database ${ENCRYPTED_FIELDS_TEXT}, così una copia del database o un backup non li mostra. Il server però ha la chiave, perché deve leggerli per calcolare saldi, budget e tasse: chi gestisce il servizio potrebbe tecnicamente leggerli.`
        : "Per calcolare saldi, budget e tasse il server deve leggere i movimenti. Sono protetti dalle connessioni cifrate e dall'accesso limitato al server, ma chi gestisce il servizio potrebbe tecnicamente leggerli.",
    },
    { title: "Nessuna certificazione", text: "BuddyBudget è un progetto piccolo: non ha certificazioni come ISO 27001 né audit esterni. Preferiamo dirlo che lasciarlo intendere." },
  ] satisfies readonly Pillar[],
} as const;

/** Testata della pagina. */
export const SECURITY_PAGE = {
  h1: "Cosa succede ai tuoi dati",
  title: "Sicurezza e privacy: come BuddyBudget tratta i tuoi dati",
  description: "Come funziona il collegamento alla banca in sola lettura (PSD2), cosa salviamo e cosa no, dove sono i server e come cancelli tutto. Con le fonti ufficiali.",
  lead: "L'app legge i tuoi conti e non può spostare soldi. Qui c'è il percorso dei dati, cosa teniamo e cosa no, con le fonti per controllare.",
} as const;

/** A sentence with links: plain strings and link pieces (`/…` internal, `mailto:` or `https:` outside). */
export type RichPart = string | { text: string; href: string };

export interface SecurityContent {
  locale: Locale;
  page: {
    h1: string;
    title: string;
    description: string;
    lead: string;
    kicker: string;
    /** Last crumb (the page name). */
    crumb: string;
    ctaTitle: string;
    ctaText: string;
    /** Title of the folded questions. */
    more: string;
    sourcesSummary: string;
    /** Last note: privacy policy and security contact. */
    legalNote: readonly RichPart[];
  };
  flow: FlowContent;
  stored: { title: string; rows: readonly StoredRow[] };
  gocardless: { question: string; lede: string; rows: readonly FactRow[]; note: readonly RichPart[] };
  ai: { question: string; lede: string; rows: readonly FactRow[]; note: readonly RichPart[] };
  analytics: { question: string; lede: string; rows: readonly FactRow[]; note: readonly RichPart[] };
  controls: { title: string; items: readonly Pillar[] };
  limits: { title: string; items: readonly Pillar[] };
  sources: Record<keyof typeof SECURITY_SOURCES, Source>;
  sourcesChecked: string;
}

/** The Italian page, assembled from the texts above. */
export const SECURITY_IT: SecurityContent = {
  locale: "it",
  page: {
    ...SECURITY_PAGE,
    kicker: "Sicurezza e privacy",
    crumb: "Sicurezza e privacy",
    ctaTitle: "Prova senza collegare niente.",
    ctaText: "Puoi iniziare con un conto manuale o con i dati d'esempio, e collegare la banca solo quando ti senti pronto.",
    more: "Le altre domande.",
    sourcesSummary: "Fonti ufficiali",
    legalNote: [
      "Per i dettagli legali (basi giuridiche, fornitori, tempi di conservazione) leggi l'",
      { text: "informativa privacy", href: LEGAL_PATHS.privacy },
      ". Per segnalare un problema di sicurezza scrivi a ",
      { text: LEGAL_OWNER.email, href: `mailto:${LEGAL_OWNER.email}` },
      ".",
    ],
  },
  flow: FLOW,
  stored: { title: STORED.title, rows: STORED.rows },
  gocardless: {
    ...GOCARDLESS_DATA,
    note: [
      "Riassunto delle ",
      { text: "condizioni UE di GoCardless", href: SECURITY_SOURCES.gocardlessTerms.href },
      " e della sua ",
      { text: "informativa privacy", href: SECURITY_SOURCES.gocardlessPrivacy.href },
      ", dove trovi i contatti per esercitare i tuoi diritti.",
    ],
  },
  ai: { ...AI_DATA, note: ["I dettagli sono nell'", { text: "informativa privacy", href: `${LEGAL_PATHS.privacy}#proposte-categorie` }, "."] },
  analytics: { ...ANALYTICS_DATA, note: ["Tutti i dettagli nella ", { text: "pagina sui cookie", href: LEGAL_PATHS.cookie }, "."] },
  controls: CONTROLS,
  limits: LIMITS,
  sources: SECURITY_SOURCES,
  sourcesChecked: SECURITY_SOURCES_CHECKED,
};
