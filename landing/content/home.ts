/**
 * Copy and facts of the «Un numero solo» home (2026-10-17): the opening with the sum, the four places money comes
 * from, what the number tells you, why to trust it, the questions and the closing. Two registers side by side: the
 * headline and the first sentence are for everyone, the small `spec` lines are for whoever wants the technical fact.
 * Only facts verifiable in the product; figures come from the demo screenshots in `public/screens/` (a made-up
 * person, «Giulia Demo»). `ITALY` (the Italian rules already in the calculations) feeds `llms.txt` and the Tasse tab.
 */
import type { ScreenId } from "./screens";
import { CONTENT_PATHS, SOURCES, type Source } from "./seo-pages";
import { FIELD_ENCRYPTION_LIVE, SECURITY_SOURCES } from "./security";
import { SUPPORTED } from "./sheet";

/** Icons available to the sections (same library as the app: lucide). The component maps the name to the icon. */
export type HomeIcon =
  | "gift" | "server" | "landmark" | "download" | "code"
  | "link" | "dashboard" | "calculator"
  | "backpack" | "scale" | "stamp" | "landmark-gov" | "umbrella" | "house"
  | "wallet" | "trending" | "card" | "user" | "shield" | "pie"
  | "key" | "eye" | "ban" | "sliders" | "file-text" | "database" | "pencil" | "chart"
  | "candles" | "layers" | "bitcoin" | "car" | "spreadsheet";

/** The opening: one promise, one sentence, one button. */
export const HERO = {
  /** Small label above the title, in the mono face. */
  index: "Patrimonio netto · ogni mattina",
  title: "Tutti i tuoi soldi, in un numero solo.",
  lede: "Conto, investimenti, pensione e mutuo insieme. Aggiornato ogni giorno, tasse comprese.",
  cta: "Inizia gratis",
  /** Secondary action: scrolls to «Da quattro posti». */
  how: "Come funziona",
  /** Short facts next to the button, the ones people check before trusting an app with their bank. */
  trust: ["Legge soltanto, non sposta soldi", "Dati in Germania", "Codice aperto", "Gratis durante la beta"],
  /** Caption under the big Panoramica window that follows the opening. */
  shot: "Panoramica · la prima schermata dell'app",
} as const;

export type SumTone = "neg";

export interface SumRow {
  /** The place, in everyday words (the app says Liquidità, Investimenti, Previdenza, Debiti). */
  label: string;
  /** How many: accounts, positions, funds, loans. */
  detail: string;
  /** Rounded value in euro, as the Panoramica sidebar shows it. */
  value: number;
  tone?: SumTone;
}

/** The sum in the opening: the four places add up to the net worth of the Panoramica screenshot beside it. */
export const SUM = {
  title: "Patrimonio netto",
  rows: [
    { label: "Conti in banca", detail: "3 conti", value: 22595 },
    { label: "Investimenti", detail: "3 titoli", value: 35389 },
    { label: "Fondo pensione", detail: "1 fondo", value: 11082 },
    { label: "Mutuo e prestiti", detail: "3 debiti", value: -39937, tone: "neg" },
  ] satisfies readonly SumRow[],
  /** Decimals of the total, as in the screenshot (the rows are rounded). */
  cents: ",53 €",
  caption: "Dati di una persona inventata, dalla Panoramica dell'app.",
} as const;

export interface SourceItem {
  name: string;
  /** The hook: what happens, in one line. */
  hook: string;
  /** One more sentence for everyone. */
  text: string;
  /** The technical facts, for whoever wants them. */
  spec: string;
  /** Logos or flags shown under the text. */
  art?: "banks" | "brokers";
}

/** «Da quattro posti, un numero»: how each place gets in, once. */
export const PLACES = {
  index: "#1 · Da dove",
  title: "Da quattro posti, un numero.",
  intro: "Ogni cosa entra una volta. Poi l'app la tiene aggiornata da sola.",
  items: [
    {
      name: "La banca",
      hook: "Si collega e legge. Non può muovere soldi.",
      text: "I movimenti arrivano da soli, con la categoria già messa. La password la scrivi solo sul sito della banca. Oppure carichi un file.",
      spec: `Open Banking (PSD2) via GoCardless · banche di ${SUPPORTED.countries.map((c) => c.name).join(", ")} · consenso di 90 giorni · aggiornamento ogni 12 ore`,
      art: "banks",
    },
    {
      name: "Il broker",
      hook: "Carichi il file. L'app legge le operazioni.",
      text: "Quanto hai comprato, a quanto, e quanto vale oggi. Più broker nello stesso portafoglio.",
      spec: "Interactive Brokers, DEGIRO, Trade Republic, Fineco, Yahoo Finance o qualsiasi CSV · nessun accesso al conto titoli · prezzi di fine giornata, cambi BCE",
      art: "brokers",
    },
    {
      name: "Il fondo pensione",
      hook: "Due numeri dal rendiconto. Quando vuoi.",
      text: "Quanto hai versato e quanto vale. Il resto lo calcola l'app, confronto con il TFR compreso.",
      spec: "Fotografie a mano o da CSV ed Excel · rendimento annuo e sui contributi · stima netta se prelevi oggi",
    },
    {
      name: "Mutuo e prestiti",
      hook: "Importo, tasso e durata. Una volta sola.",
      text: "Il piano rata per rata, le prossime scadenze e cosa cambia se paghi di più.",
      spec: "Piano alla francese, TAEG, extra mensili, estinzione parziale, surroga · da tre dati fra capitale, rata, numero di rate e tasso ricava il quarto",
    },
  ] satisfies readonly SourceItem[],
  /** Closing line of the section, where the four rows meet. */
  result: "Il numero, ogni mattina.",
  banks: SUPPORTED.countries,
  brokers: SUPPORTED.brokers,
} as const;

export type ShowcaseId = "spese" | "investimenti" | "tasse" | "mutuo" | "futuro";

export interface ShowcaseTab {
  id: ShowcaseId;
  /** Label of the tab, one word. */
  tab: string;
  /** The hook, as a question or a short promise. */
  title: string;
  text: string;
  /** The figure from the screenshot and what it is. */
  figure: { value: string; small?: string; tone?: "pos" | "neg"; caption: string };
  shot: ScreenId;
  more?: { href: string; label: string };
}

/** «Cosa ti dice, ogni giorno»: five things the number knows, each with the real screen and its figure. */
export const SHOWCASE = {
  index: "#2 · Cosa ti dice",
  title: "Cosa ti dice, ogni giorno.",
  intro: "Cinque schermate vere, con i dati della stessa persona inventata.",
  tabs: [
    {
      id: "spese",
      tab: "Spese",
      title: "Dove vanno i soldi, senza scrivere niente.",
      text: "I movimenti arrivano dalla banca. L'app li divide in quattro gruppi e ti chiede solo quando ha un dubbio.",
      figure: { value: "2.164", small: " €", caption: "spesi a ottobre, finora · 5 movimenti da decidere, il resto l'ha messo l'app" },
      shot: "movimenti",
    },
    {
      id: "investimenti",
      tab: "Investimenti",
      title: "Quanto hai guadagnato davvero.",
      text: "Tolti i soldi che hai versato tu. A confronto con il mercato e con l'inflazione, e con il rischio detto in una parola.",
      figure: { value: "+1,4", small: " %", tone: "pos", caption: "in tre mesi, tolti i versamenti · rischio basso" },
      shot: "performance",
      more: { href: CONTENT_PATHS.funzioneInvestimenti, label: "Tutto sugli investimenti" },
    },
    {
      id: "tasse",
      tab: "Tasse",
      title: "Quante tasse paghi se vendi. Prima di vendere.",
      text: "26% sui guadagni, 12,5% sui titoli di Stato, le perdite degli anni scorsi che abbassano il conto, il bollo. È una stima: il conto finale lo fa il broker.",
      figure: { value: "146", small: ",93 €", caption: "di tasse se vendi tutto l'ETF d'esempio oggi · ti restano 19.625,25 €" },
      shot: "tasse",
      more: { href: CONTENT_PATHS.zainetto, label: "Prova il calcolatore, senza account" },
    },
    {
      id: "mutuo",
      tab: "Mutuo",
      title: "Conviene chiudere il mutuo prima?",
      text: "Scrivi quanto puoi pagare in più al mese. Vedi quando finisci e quanti interessi risparmi. I soldi in più vanno prima sul debito che costa di più.",
      figure: { value: "3 anni e 2 mesi", caption: "prima, con 200 € in più al mese · 1.708 € di interessi risparmiati" },
      shot: "debiti",
      more: { href: CONTENT_PATHS.ammortamento, label: "Prova il calcolatore della rata" },
    },
    {
      id: "futuro",
      tab: "Futuro",
      title: "Quando puoi smettere di lavorare.",
      text: "Parte da quanto risparmi e spendi davvero, non da un'ipotesi. Muovi un cursore e l'anno cambia.",
      figure: { value: "2046", caption: "tra 19,2 anni, ai ritmi di oggi · le ipotesi sono scritte sotto i cursori" },
      shot: "analitiche",
    },
  ] satisfies readonly ShowcaseTab[],
  /** Below the tabs: the whole gallery. */
  all: "Tutte le schermate",
} as const;

export interface TrustFact {
  icon: HomeIcon;
  title: string;
  text: string;
  source?: Source;
}

/** «Legge soltanto. Non sposta soldi.»: four facts for everyone, two limits said plainly. Every sentence is verified in `security.ts`. */
export const TRUST = {
  index: "#3 · Fiducia",
  title: "Legge soltanto. Non sposta soldi.",
  intro: "È la prima domanda di tutti. Risposte corte, con le fonti.",
  facts: [
    {
      icon: "key",
      title: "La password della banca resta alla banca.",
      text: "La scrivi solo sul suo sito. Il collegamento può leggere e basta, e lo togli quando vuoi.",
      source: { label: "PSD2, art. 67", href: SECURITY_SOURCES.psd2.href },
    },
    {
      icon: "server",
      title: "I dati stanno in Germania.",
      text: FIELD_ENCRYPTION_LIVE
        ? "Connessioni cifrate; descrizioni e note dei movimenti cifrate anche nel database. Copie di sicurezza in Europa per 14 giorni."
        : "Connessioni cifrate. Copie di sicurezza in Europa per 14 giorni.",
      source: { label: "Cloudflare R2, dati nell'UE", href: SECURITY_SOURCES.r2Location.href },
    },
    {
      icon: "ban",
      title: "Niente pubblicità, niente vendita di dati.",
      text: "Le statistiche d'uso sono anonime e senza cookie, sui nostri server.",
    },
    {
      icon: "download",
      title: "Porti via tutto quando vuoi.",
      text: "Un file ZIP con tutti i dati, oppure elimini l'account: subito, o con 30 giorni per ripensarci.",
    },
  ] satisfies readonly TrustFact[],
  limits: [
    { title: "Il server legge i dati", text: "Deve farlo per fare i conti, quindi chi gestisce il servizio potrebbe vederli. Preferiamo dirlo." },
    { title: "Nessuna certificazione", text: "È un progetto piccolo: niente ISO 27001 né controlli esterni. Il codice aperto è il modo per controllare." },
  ],
  more: "Tutta la sicurezza, con le fonti",
} as const;

export interface HoodFact {
  label: string;
  value: string;
  /** Path in the repository, relative to `SOURCE_URL`; shown as a link only when the repository is public. */
  path?: string;
}

/** «Sotto il cofano»: the technical facts, for whoever wants to read the code or run it at home. */
export const UNDER_HOOD = {
  title: "Il codice è aperto. Leggilo, o installalo a casa tua.",
  text: "Tutta l'app è pubblica, con licenza AGPL-3.0. Puoi leggere come tratta i dati, segnalare un problema o farla girare su un server tuo con Docker.",
  cta: "Vedi il codice su GitHub",
  selfHost: "Guida al self-hosting",
  selfHostPath: "/blob/main/docs/self-hosting.md",
  /** The commands of the self-hosting guide (`docs/self-hosting.md`) after `git clone <SOURCE_URL>.git`, shown to copy. */
  command: {
    label: "Installalo a casa tua",
    lines: [
      "cd buddy-budget",
      "./scripts/selfhost-init.sh",
      "docker compose up -d",
    ],
    copy: "Copia",
    copied: "Copiato",
  },
  who: "Dietro c'è una persona, a Torino. Scrivi a",
  whoTail: "e ti risponde lei.",
  facts: [
    { label: "Licenza", value: "AGPL-3.0" },
    { label: "Stack", value: "TypeScript · Next.js · Postgres · Redis" },
    { label: "A casa tua", value: "Docker Compose: app, database, cron", path: "/blob/main/docs/self-hosting.md" },
    { label: "Banca", value: "Open Banking (PSD2) via GoCardless, sola lettura" },
    ...(FIELD_ENCRYPTION_LIVE ? [{ label: "Nel database", value: "Descrizioni e note cifrate (AES-256)" }] : []),
    { label: "I tuoi dati", value: "Export ZIP in JSON e CSV, cancellazione dall'app" },
    { label: "Accesso", value: "Link via email o Google, nessuna password" },
    { label: "Sicurezza", value: "SECURITY.md", path: "/blob/main/SECURITY.md" },
  ] satisfies readonly HoodFact[],
} as const;

export const FAQ_HOME = { index: "#4 · Domande", title: "Prima di iscriverti.", intro: "Le domande che arrivano più spesso. Tocca per leggere." } as const;

export const CLOSE = {
  title: "Il tuo numero, da domani mattina.",
  note: "Entri con un link via email o con Google. Nessuna password da ricordare.",
  cta: "Inizia gratis",
  tools: "Prova un calcolatore",
} as const;

export interface ItalyRule {
  icon: HomeIcon;
  /** The rule, as the guides write it. */
  rule: string;
  /** What BuddyBudget does with that rule. */
  app: string;
  link?: { href: string; label: string };
  source?: Source;
}

/** Italian tax and banking rules already in the calculations (`llms.txt`). Sources are the same as the guide pages (`SOURCES`). */
export const ITALY = {
  kicker: "Fatto per l'Italia",
  title: "Le regole italiane, già nei conti.",
  lede: "Perdite da scalare, aliquote, bollo, TFR: cose che un'app fatta per un altro paese non conosce. Qui sono già nei conti, come stime per decidere.",
  rules: [
    {
      icon: "backpack",
      rule: "Le perdite si possono scalare dai guadagni per quattro anni.",
      app: "Tiene il conto delle perdite anno per anno (lo «zainetto fiscale») e ti dice quanto scade e quando.",
      link: { href: CONTENT_PATHS.zainetto, label: "Calcolatore dello zainetto" },
      source: SOURCES.tuir68,
    },
    {
      icon: "scale",
      rule: "I guadagni degli ETF non si possono compensare con le perdite.",
      app: "Tiene separati i due tipi di guadagno, così non ti promette sconti che non esistono.",
      link: { href: CONTENT_PATHS.guidaZainetto, label: "La guida, con esempi" },
      source: SOURCES.quadroRt,
    },
    {
      icon: "landmark-gov",
      rule: "I titoli di Stato pagano il 12,5%, il resto il 26%.",
      app: "Applica la tassa giusta a ogni operazione, BTP compresi.",
      source: SOURCES.circolare19e,
    },
    {
      icon: "stamp",
      rule: "Ogni anno si paga l'imposta di bollo sul deposito titoli.",
      app: "La stima sul valore del portafoglio, insieme alle tasse se vendessi oggi.",
    },
    {
      icon: "umbrella",
      rule: "Fondo pensione e TFR in azienda hanno tasse diverse.",
      app: "Confronta gli stessi versamenti nei due casi e stima quanto ti resterebbe prelevando oggi.",
    },
    {
      icon: "house",
      rule: "Il mutuo per la casa si può chiudere in anticipo senza penali.",
      app: "Prova a rimborsare una parte: rata più bassa o durata più corta, e quanto risparmi di interessi.",
      link: { href: CONTENT_PATHS.ammortamento, label: "Calcolatore della rata" },
      source: SOURCES.guidaMutuo,
    },
  ] satisfies readonly ItalyRule[],
} as const;
