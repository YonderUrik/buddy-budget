/** Indirizzi e testi della landing. Gli URL arrivano dall'env, con default di produzione. */
import { FIELD_ENCRYPTION_LIVE } from "./security";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://buddybudget.io";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.buddybudget.io";
/**
 * Repository pubblico del codice. Vuoto finché il repo è privato: senza valore la landing non mostra nessun link
 * (così non ne pubblica uno rotto). Si attiva impostando `NEXT_PUBLIC_SOURCE_URL` (vedi `Dockerfile`).
 */
export const SOURCE_URL = process.env.NEXT_PUBLIC_SOURCE_URL ?? "";
/** Pagina pubblica con lo stato del servizio (UptimeRobot, piano gratuito: niente dominio nostro). */
export const STATUS_URL = process.env.NEXT_PUBLIC_STATUS_URL ?? "https://stats.uptimerobot.com/BCuTWm0Ukg";
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
  { question: "Come si collega la banca?", answer: "In tre passi. Nell'app scegli la tua banca; si apre il sito della tua banca, dove entri come fai sempre e confermi che BuddyBudget può leggere saldi e movimenti; da lì i movimenti arrivano da soli. La password la scrivi solo sul sito della banca, noi non la vediamo, e nessuno può spostare soldi dal tuo conto. Il collegamento passa da GoCardless, una società autorizzata dall'autorità di vigilanza bancaria francese a fare proprio questo, come prevede la legge europea sull'Open Banking (PSD2). Il permesso dura 90 giorni, ti avvisiamo prima che scada e puoi toglierlo quando vuoi." },
  { question: "Calcola le tasse italiane sugli investimenti?", answer: "Sì. Dalle tue operazioni ricava plusvalenze, zaino fiscale a quattro anni, imposta di bollo e l'imposta che pagheresti vendendo oggi. Sono stime pensate per decidere, non sostituiscono il rendiconto del tuo intermediario né un consulente." },
  { question: "Quali investimenti posso tracciare?", answer: "ETF, azioni, BTP e titoli di Stato, fondi e crypto. Vedi il rendimento vero, il confronto con un indice a parità di versamenti, rischio e diversificazione, più i proventi (dividendi e cedole)." },
  { question: "Come funziona la parte sul fondo pensione?", answer: "Il tuo fondo ti mostra spesso solo contributi netti e controvalore. Inserisci questi due numeri ogni tanto. Oppure importa lo storico da un file CSV o Excel. BuddyBudget calcola versamenti e rendimento. Stima quanto ti resterebbe se prelevi oggi, al netto delle tasse. Inoltre confronta il fondo con il TFR in azienda. Le regole fiscali sono stime." },
  { question: "Posso simulare l'estinzione anticipata di un finanziamento o di un mutuo?", answer: "Sì. Inserisci i dettagli del debito e guarda il piano di ammortamento. Vedi anche il TAEG e gli interessi risparmiati. Puoi vedere la penale se riduci la rata o la durata, oppure se fai la surroga." },
  { question: "Cos'è la sezione Analitiche?", answer: "Una sezione per chi ama i numeri, aperta a chiunque voglia entrarci. Mostra l'anno in cui puoi smettere di lavorare e ti lascia provare «e se…» con quattro cursori (risparmio, spesa, rendimento, prelievo) senza salvare nulla. Risparmio, spesa e rendimento partono dai tuoi movimenti e investimenti degli ultimi 12 o 24 mesi, o dei mesi che scegli; se mancano dati li scrivi tu. Sotto, quattro risposte in parole semplici: quanta strada hai fatto, quando puoi smettere di lavorare, se il patrimonio reggerà e quanto ti costa il portafoglio. Sotto ogni risposta, nella sezione «Per esperti», trovi il numero FIRE dopo le imposte. Trovi anche migliaia di scenari di mercato. Inoltre, vedi un confronto tra regole di prelievo, rischio e costi. Ogni risultato parte da ipotesi che scegli tu, con una guida alla prima visita. Sono stime, non previsioni né consulenza." },
  { question: "Dove sono i miei dati e posso portarli via?", answer: (FIELD_ENCRYPTION_LIVE ? "App e database girano su un server in Germania, le connessioni sono cifrate e descrizioni e note dei movimenti sono cifrate anche nel database." : "App e database girano su un server in Germania e le connessioni sono cifrate.") + " Non vendiamo i dati e non facciamo pubblicità. Scarichi tutto in un file ZIP, azzeri i dati o elimini l'account dalle impostazioni, quando vuoi." },
  { question: "In che lingua e in che valuta funziona?", answer: "Per ora in italiano e in euro. L'app è pensata per più lingue e valute, che arriveranno più avanti." },
  { question: "Funziona su telefono?", answer: "Sì. BuddyBudget si usa dal browser su computer e telefono e si installa come app (PWA) sulla schermata Home, senza passare dagli store." },
];

/** Le domande mostrate in home (e nel suo JSON-LD): le altre stanno nelle pagine di approfondimento e in `llms.txt`. */
const HOME_FAQ_QUESTIONS = new Set([
  "BuddyBudget è gratuito?",
  "Come si collega la banca?",
  "Calcola le tasse italiane sugli investimenti?",
  "Dove sono i miei dati e posso portarli via?",
  "Funziona su telefono?",
]);
export const HOME_FAQ: readonly FaqItem[] = FAQ.filter((q) => HOME_FAQ_QUESTIONS.has(q.question));

/** Destinazioni dei pulsanti verso l'app. */
/** Link verso l'app, con UTM per distinguere in Umami gli arrivi dalla landing. */
const LOGIN_URL = `${APP_URL}/login?utm_source=landing&utm_medium=cta`;
export const APP_LINKS = { signup: LOGIN_URL, login: LOGIN_URL } as const;

/** Cosa fa BuddyBudget per i dati: solo fatti verificabili nel codice o nell'infrastruttura, niente promesse generiche. */
export const SECURITY = {
  kicker: "Sicurezza e privacy",
  title: "Cosa vede BuddyBudget dei tuoi dati, e cosa no.",
  intro: "Le credenziali della banca restano alla banca: verso BuddyBudget viaggiano solo saldi e movimenti, in sola lettura.",
  /** Fatti con la loro fonte ufficiale, sotto il diagramma. */
  facts: [
    { text: "Il collegamento lo fa GoCardless, autorizzata dalla vigilanza bancaria francese", source: "https://gocardless.com/legal/bank-account-data/" },
    { text: "Solo lettura e solo col tuo permesso, come vuole la legge europea", source: "https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32015L2366" },
    { text: "Server in Germania, backup nell'UE per 14 giorni", source: "https://developers.cloudflare.com/r2/reference/data-location/" },
  ],
  more: "Tutti i dettagli: cosa salviamo, cosa tiene GoCardless, come cancelli tutto",
  /** Chi c'è dietro e come si parla con una persona: nei test con utenti nessuno lo trovava. */
  who: {
    title: "Chi c'è dietro",
    text: "BuddyBudget è un progetto indipendente nato in Italia: non è una banca e non vende i tuoi dati. Il codice è pubblico, così chiunque può controllare cosa fa. Per un dubbio o un problema scrivi a",
    tail: "e ti risponde una persona.",
  },
  /** Il collegamento in parole semplici, prima del diagramma: chi ha provato la landing non conosceva «PSD2». */
  stepsTitle: "Come si collega la banca, in tre passi",
  steps: [
    { title: "Scegli la tua banca", text: "Nell'app, dall'elenco delle banche del tuo paese." },
    { title: "Confermi sul sito della banca", text: "Entri come fai sempre e dai il permesso di leggere saldi e movimenti. La password la scrivi solo lì." },
    { title: "I movimenti arrivano da soli", text: "Ogni 12 ore. Il permesso dura 90 giorni e si rinnova con un clic; nessuno può spostare soldi e lo togli quando vuoi." },
  ],
} as const;


/** Indirizzo a cui risponde una persona (lo stesso dell'app, «Scrivici»). */
export const SUPPORT_EMAIL = "support@buddybudget.io";
