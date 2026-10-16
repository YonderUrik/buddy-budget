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

/** Domande frequenti: poche e corte, lo stesso testo nella sezione visibile e nei dati strutturati FAQPage (Google vuole che coincidano). */
export const FAQ: readonly FaqItem[] = [
  { question: "È gratis?", answer: "Sì, durante la beta. Se cambierà lo diremo in anticipo e potrai esportare tutto in un file ZIP." },
  { question: "Serve collegare la banca?", answer: "No. Puoi aggiungere i conti a mano o caricare un file. Il collegamento serve solo a non scrivere i movimenti a mano, e può solo leggere." },
  { question: "Le tasse sono quelle vere?", answer: "Sono stime con le regole italiane (26% sui guadagni, 12,5% sui titoli di Stato, perdite da scalare per quattro anni, bollo). Servono per decidere. Il conto definitivo lo fa la banca o il commercialista." },
  { question: "Cosa non fa?", answer: "Non ti dice cosa comprare o vendere. Non sposta soldi e non fa ordini al broker. I prezzi sono di fine giornata, non in tempo reale. Per ora in italiano e in euro." },
  { question: "Dove stanno i miei dati e posso portarli via?", answer: (FIELD_ENCRYPTION_LIVE ? "Su un server in Germania, con le connessioni cifrate e descrizioni e note dei movimenti cifrate anche nel database." : "Su un server in Germania, con le connessioni cifrate.") + " Non vendiamo i dati e non c'è pubblicità. Scarichi tutto in ZIP, azzeri i dati o elimini l'account dalle impostazioni, quando vuoi." },
  { question: "Funziona sul telefono?", answer: "Sì, dal browser, e si può mettere sulla schermata Home come un'app. Non è negli store." },
];

/** Indirizzo del supporto: risponde una persona. */
export const SUPPORT_EMAIL = "support@buddybudget.io";

/** Destinazioni dei pulsanti verso l'app. */
/** Link verso l'app, con UTM per distinguere in Umami gli arrivi dalla landing. */
const LOGIN_URL = `${APP_URL}/login?utm_source=landing&utm_medium=cta`;
export const APP_LINKS = { signup: LOGIN_URL, login: LOGIN_URL } as const;

/** Cosa fa BuddyBudget per i dati: solo fatti verificabili nel codice o nell'infrastruttura, niente promesse generiche. */
export const SECURITY = {
  kicker: "Sicurezza e privacy",
  title: "Cosa vede BuddyBudget dei tuoi dati, e cosa no.",
  intro: "Le credenziali della banca restano alla banca: verso BuddyBudget viaggiano solo saldi e movimenti, in sola lettura. Tocca un passaggio per vedere cosa riceve.",
  /** Fatti con la loro fonte ufficiale, sotto il diagramma. */
  facts: [
    { text: "GoCardless SAS è autorizzata dall'ACPR, n. 17118", source: "https://gocardless.com/legal/bank-account-data/" },
    { text: "Sola lettura con consenso esplicito (PSD2, art. 67)", source: "https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32015L2366" },
    { text: "Server in Germania, backup nell'UE per 14 giorni", source: "https://developers.cloudflare.com/r2/reference/data-location/" },
  ],
  more: "Tutti i dettagli: cosa salviamo, cosa tiene GoCardless, come cancelli tutto",
} as const;

