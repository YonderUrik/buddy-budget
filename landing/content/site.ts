/** Addresses and site-wide texts of the landing. URLs come from the environment, with production defaults. */
import type { Locale } from "@/lib/i18n";
import type { RuleNeed } from "@/lib/visitor-country";
import { FIELD_ENCRYPTION_LIVE } from "./security";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://buddybudget.io";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.buddybudget.io";
/**
 * Public repository of the code (`NEXT_PUBLIC_SOURCE_URL`, set in the `Dockerfile`). Empty in a local build without
 * the variable: the landing then shows the open-source facts without a link, so it never publishes a broken one.
 */
export const SOURCE_URL = process.env.NEXT_PUBLIC_SOURCE_URL ?? "";
/** Public status page (UptimeRobot, free plan: not on our domain). */
export const STATUS_URL = process.env.NEXT_PUBLIC_STATUS_URL ?? "https://stats.uptimerobot.com/BCuTWm0Ukg";
/** License of the code, shown next to the link. */
export const SOURCE_LICENSE = "AGPL-3.0";

export const SITE_NAME = "BuddyBudget";
/** Home title: brand + the promise + the words people search for (conti, investimenti, pensione, mutuo), within ~60 characters. */
export const SITE_TITLE = "BuddyBudget: conti, investimenti, pensione e mutuo in un numero";
export const SITE_DESCRIPTION =
  "Conto, investimenti, fondo pensione e mutuo in un numero solo, aggiornato ogni giorno con le tasse italiane già calcolate. Carichi l'estratto conto della banca; il collegamento diretto arriva presto. Liquidità gratis, il resto con Pro, codice aperto.";
/** Preview image for social networks and rich results (1200×630, see `scripts/make-og-image.mjs`). */
export const OG_IMAGE = { url: "/og.png", width: 1200, height: 630, alt: "BuddyBudget: tutti i tuoi soldi, in un numero solo" } as const;

export interface FaqItem {
  question: string;
  answer: string;
  /** Hidden on the page for visitors whose country lacks these rules (it stays in the structured data). */
  needs?: RuleNeed;
}

/** Address of the support: a person answers. */
export const SUPPORT_EMAIL = "support@buddybudget.io";

/**
 * Frequently asked questions: few and short, the same text in the visible section and in the FAQPage structured
 * data (Google wants them to match). The self-hosting question appears only when the repository is public.
 */
export const FAQ: readonly FaqItem[] = [
  { question: "È gratis?", answer: "La sezione Liquidità sì, senza scadenza. Pro sblocca tutto il resto a 1,99 € al mese o 20 € all'anno, con 14 giorni di prova gratuita; finché Pro non parte è tutto sbloccato. Se lo installi sui tuoi server è tutto gratis, e i tuoi dati si portano via in un file ZIP." },
  { question: "Si collega alla banca?", answer: "Non ancora: il collegamento in sola lettura con l'Open Banking arriva presto. Intanto carichi l'estratto conto in CSV o Excel, o aggiungi i conti a mano." },
  { question: "Le tasse sono quelle vere?", needs: "taxes", answer: "Sono stime con le regole italiane: 26% sui guadagni, 12,5% sui titoli di Stato, perdite da scalare per quattro anni, bollo. Servono per decidere. Il conto finale lo fa la banca o il commercialista." },
  { question: "Cosa non fa?", answer: "Non ti dice cosa comprare o vendere. Non sposta soldi e non fa ordini al broker. I prezzi sono di fine giornata, non in tempo reale." },
  {
    question: "Dove stanno i miei dati?",
    answer: `${FIELD_ENCRYPTION_LIVE ? "Su un server in Germania, con le connessioni cifrate e descrizioni e note dei movimenti cifrate anche nel database." : "Su un server in Germania, con le connessioni cifrate."} Non vendiamo i dati e non c'è pubblicità. Scarichi tutto in ZIP o elimini l'account quando vuoi.`,
  },
  { question: "Funziona sul telefono?", answer: "Sì, dal browser. Si mette sulla schermata Home come un'app. Non è negli store." },
  { question: "In quali lingue e paesi?", answer: "Italia in italiano e inglese, Germania in tedesco e inglese, gli altri paesi in una delle tre lingue. La valuta la scegli tu. In Germania le stime fiscali sono parziali, con i limiti scritti chiaramente, e la pensione arriverà dopo una revisione. Negli altri paesi mancano pensione e tasse: tutto il resto funziona. Questo sito parla del prodotto per l'Italia." },
  ...(SOURCE_URL
    ? [{ question: "Posso installarlo su un server mio?", answer: "Sì. Il codice è aperto (AGPL-3.0) e c'è un Docker Compose con app, database e cron. Si entra con email e password, senza bisogno di un server di posta. La guida al self-hosting è nel repository." }]
    : []),
];

export interface AppLinks {
  signup: string;
  login: string;
  /** Public read-only demo (`/demo` in the app): signs the visitor into a sample account, no signup. */
  demo: string;
}

/** Destinations of the buttons towards the app, with UTM to tell landing arrivals apart in Umami. */
const LOGIN_URL = `${APP_URL}/login?utm_source=landing&utm_medium=cta`;
/** Query flag that makes the sign-in page speak to a new user («Crea il tuo account») instead of «Entra». */
export const SIGNUP_FLAG = "signup=1";
const SIGNUP_URL = `${LOGIN_URL}&${SIGNUP_FLAG}`;
export const DEMO_URL = `${APP_URL}/demo`;
export const APP_LINKS = { signup: SIGNUP_URL, login: LOGIN_URL, demo: DEMO_URL } as const satisfies AppLinks;

/**
 * The destinations per language: the same on every page, because the app picks the language from the visitor's
 * country. Only an explicit choice on the landing adds `lang=` (client-side, `UtmPassthrough`).
 */
export const LOCALE_APP_LINKS: Record<Locale, AppLinks> = { it: APP_LINKS, en: APP_LINKS };
