/** Addresses and site-wide texts of the landing. URLs come from the environment, with production defaults. */
import type { Locale } from "@/lib/i18n";
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
  "Conto, investimenti, fondo pensione e mutuo in un numero solo, aggiornato ogni giorno con le tasse italiane già calcolate. La banca si collega in sola lettura, oppure carichi un file. Gratis durante la beta, codice aperto.";
/** Preview image for social networks and rich results (1200×630, see `scripts/make-og-image.mjs`). */
export const OG_IMAGE = { url: "/og.png", width: 1200, height: 630, alt: "BuddyBudget: tutti i tuoi soldi, in un numero solo" } as const;

export interface FaqItem {
  question: string;
  answer: string;
}

/** Address of the support: a person answers. */
export const SUPPORT_EMAIL = "support@buddybudget.io";

/**
 * Frequently asked questions: few and short, the same text in the visible section and in the FAQPage structured
 * data (Google wants them to match). The self-hosting question appears only when the repository is public.
 */
export const FAQ: readonly FaqItem[] = [
  { question: "È gratis?", answer: "Sì, durante la beta. Se cambierà lo diremo prima, e potrai portare via tutto in un file ZIP." },
  { question: "Devo collegare la banca?", answer: "No. Puoi aggiungere i conti a mano o caricare un file. Il collegamento serve solo a non scrivere i movimenti, e può solo leggere." },
  { question: "Le tasse sono quelle vere?", answer: "Sono stime con le regole italiane: 26% sui guadagni, 12,5% sui titoli di Stato, perdite da scalare per quattro anni, bollo. Servono per decidere. Il conto finale lo fa la banca o il commercialista." },
  { question: "Cosa non fa?", answer: "Non ti dice cosa comprare o vendere. Non sposta soldi e non fa ordini al broker. I prezzi sono di fine giornata, non in tempo reale." },
  {
    question: "Dove stanno i miei dati?",
    answer: `${FIELD_ENCRYPTION_LIVE ? "Su un server in Germania, con le connessioni cifrate e descrizioni e note dei movimenti cifrate anche nel database." : "Su un server in Germania, con le connessioni cifrate."} Non vendiamo i dati e non c'è pubblicità. Scarichi tutto in ZIP o elimini l'account quando vuoi.`,
  },
  { question: "Funziona sul telefono?", answer: "Sì, dal browser. Si mette sulla schermata Home come un'app. Non è negli store." },
  { question: "In quali lingue e paesi?", answer: "Italia in italiano e inglese, Germania in tedesco e inglese. La valuta la scegli tu. Per la Germania ci sono le funzioni essenziali e stime fiscali parziali, con i limiti scritti chiaramente; pensione e simulatori avanzati sono nascosti in attesa di revisione. Questo sito parla del prodotto per l'Italia." },
  ...(SOURCE_URL
    ? [{ question: "Posso installarlo su un server mio?", answer: "Sì. Il codice è aperto (AGPL-3.0) e c'è un Docker Compose con app, database e cron. La guida al self-hosting è nel repository." }]
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
export const DEMO_URL = `${APP_URL}/demo`;
export const APP_LINKS = { signup: LOGIN_URL, login: LOGIN_URL, demo: DEMO_URL } as const satisfies AppLinks;

/** The same destinations per language: the English pages ask the app for English with `lang=en`. */
export const LOCALE_APP_LINKS: Record<Locale, AppLinks> = {
  it: APP_LINKS,
  en: { signup: `${LOGIN_URL}&lang=en`, login: `${LOGIN_URL}&lang=en`, demo: `${DEMO_URL}?lang=en` },
};
