/** Indirizzi e testi della landing. Gli URL arrivano dall'env, con default di produzione. */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://buddybudget.io";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.buddybudget.io";
/**
 * Repository pubblico del codice. Vuoto finché il repo è privato: senza valore la landing non mostra nessun link
 * (così non ne pubblica uno rotto). Si attiva impostando `NEXT_PUBLIC_SOURCE_URL` (vedi `Dockerfile`).
 */
export const SOURCE_URL = process.env.NEXT_PUBLIC_SOURCE_URL ?? "";
/** Licenza del codice, mostrata accanto al link. */
export const SOURCE_LICENSE = "AGPL-3.0";

export const SITE_NAME = "BuddyBudget";
/** Title della home: marchio + parole che la gente cerca (budget, investimenti, pensione, debiti), entro ~60 caratteri. */
export const SITE_TITLE = "BuddyBudget: app per budget, investimenti, pensione e debiti";
export const SITE_DESCRIPTION =
  "Gestisci conti, spese, investimenti, fondo pensione e debiti in un'unica app, con le tasse italiane già calcolate. Collega la banca, categorizza i movimenti e conosci il tuo patrimonio netto.";
/** Immagine di anteprima per social e risultati arricchiti (1200×630, vedi `scripts/make-og-image.mjs`). */
export const OG_IMAGE = { url: "/og.png", width: 1200, height: 630, alt: "BuddyBudget: conti, investimenti, pensione e debiti in un solo quadro" } as const;

export interface FaqItem {
  question: string;
  answer: string;
}

/** Domande frequenti: stesso testo nella sezione visibile e nei dati strutturati FAQPage (Google vuole che coincidano). */
export const FAQ: readonly FaqItem[] = [
  { question: "BuddyBudget è gratuito?", answer: "Sì, al momento l'uso è gratuito. Se in futuro cambierà, lo comunicheremo in anticipo e potrai esportare tutti i tuoi dati in ZIP." },
  { question: "Come si collega la banca?", answer: "Con l'Open Banking (PSD2), tramite un fornitore regolato. Autorizzi l'accesso presso la tua banca in sola lettura: BuddyBudget vede saldi e movimenti, non può muovere denaro e non conosce le tue credenziali. Il consenso dura al massimo 90 giorni e ti avvisiamo prima che scada." },
  { question: "Calcola le tasse italiane sugli investimenti?", answer: "Sì. Dalle tue operazioni ricava plusvalenze, zaino fiscale a quattro anni, imposta di bollo e l'imposta che pagheresti vendendo oggi. Sono stime pensate per decidere, non sostituiscono il rendiconto del tuo intermediario né un consulente." },
  { question: "Quali investimenti posso tracciare?", answer: "ETF, azioni, BTP e titoli di Stato, fondi e crypto. Vedi il rendimento vero, il confronto con un indice a parità di versamenti, rischio e diversificazione, più i proventi (dividendi e cedole)." },
  { question: "Come funziona la parte sul fondo pensione?", answer: "Il tuo fondo ti mostra spesso solo contributi netti e controvalore. Inserisci questi due numeri ogni tanto, o importa lo storico da un file CSV o Excel, e BuddyBudget ricava versamenti e rendimento, stima quanto ti resterebbe prelevando oggi al netto delle tasse e confronta il fondo con il TFR in azienda. Le regole fiscali sono stime." },
  { question: "Posso simulare l'estinzione anticipata di un finanziamento o di un mutuo?", answer: "Sì. Inserisci le condizioni del debito e vedi il piano di ammortamento, il TAEG, gli interessi risparmiati e la penale se riduci la rata o la durata, oppure se lo surroghi. C'è anche il Credit Lombard contro il tuo portafoglio." },
  { question: "Cos'è la sezione Analitiche?", answer: "Una sezione per chi ama i numeri, aperta a chiunque voglia entrarci. Calcola il tuo numero FIRE al netto delle imposte, simula migliaia di futuri possibili del patrimonio, confronta quattro regole di prelievo e misura rischio e costi. Ogni risultato parte da ipotesi che scegli tu ed è spiegato passo passo, con una guida alla prima visita. Sono stime, non previsioni né consulenza." },
  { question: "Dove sono i miei dati e posso portarli via?", answer: "App e database girano su un server in Germania e le connessioni sono cifrate. Non vendiamo i dati e non facciamo pubblicità. Scarichi tutto in un file ZIP, azzeri i dati o elimini l'account dalle impostazioni, quando vuoi." },
  { question: "In che lingua e in che valuta funziona?", answer: "Per ora in italiano e in euro. L'app è pensata per più lingue e valute, che arriveranno più avanti." },
  { question: "Funziona su telefono?", answer: "Sì. BuddyBudget si usa dal browser su computer e telefono e si installa come app (PWA) sulla schermata Home, senza passare dagli store." },
];

/** Destinazioni dei pulsanti verso l'app. */
/** Link verso l'app, con UTM per distinguere in Umami gli arrivi dalla landing. */
const LOGIN_URL = `${APP_URL}/login?utm_source=landing&utm_medium=cta`;
export const APP_LINKS = { signup: LOGIN_URL, login: LOGIN_URL } as const;

/** Illustrazione animata del riquadro (vedi `SecurityArt`). */
export type SecurityArtId = "password" | "bank" | "sell" | "control";

export interface SecurityPoint {
  art: SecurityArtId;
  title: string;
  text: string;
}

/** Cosa fa BuddyBudget per i dati: solo fatti verificabili nel codice o nell'infrastruttura, niente promesse generiche. */
export const SECURITY = {
  kicker: "Sicurezza e privacy",
  title: "Cosa vede BuddyBudget dei tuoi dati, e cosa no.",
  intro: "I server sono in Germania e le connessioni sono cifrate. Questi sono gli impegni, uno per uno.",
  points: [
    { art: "password", title: "Nessuna password da rubare", text: "Si entra con un link via email o con Google. Non conserviamo password." },
    { art: "bank", title: "Banca in sola lettura", text: "Il collegamento ai conti passa da un fornitore regolato (PSD2) e permette solo di leggere saldi e movimenti, mai di muovere denaro. Il consenso scade e lo rinnovi tu." },
    { art: "sell", title: "Non vendiamo i tuoi dati", text: "Niente pubblicità, niente cookie di profilazione, niente rivendita. Le statistiche d'uso sono anonime e le spegni dalle impostazioni." },
    { art: "control", title: "Sei tu a decidere", text: "Scarichi tutto in un file, azzeri i dati o elimini l'account quando vuoi, e puoi nascondere gli importi a schermo." },
  ] satisfies readonly SecurityPoint[],
  legalNote: "Maggiori dettagli nella",
  sourceNote: "Il codice dell'app è pubblico:",
} as const;
