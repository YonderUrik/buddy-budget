/**
 * Copy and facts of the «Un numero solo» home (2026-10-17): the opening with the sum, the four places money comes
 * from, what the number tells you, why to trust it, the questions and the closing. Two registers side by side: the
 * headline and the first sentence are for everyone, the small `spec` lines are for whoever wants the technical fact.
 * Only facts verifiable in the product; figures come from the demo screenshots in `public/screens/` (a made-up
 * person, «Giulia Demo»). `ITALY` (the Italian rules already in the calculations) feeds `llms.txt` and the Tasse tab.
 */
import type { Locale } from "@/lib/i18n";
import type { ByRules, RuleNeed } from "@/lib/visitor-country";
import type { ScreenId } from "./screens";
import { CONTENT_PATHS, SOURCES, type Source } from "./seo-pages";
import { FIELD_ENCRYPTION_LIVE, SECURITY_SOURCES } from "./security";
import { SUPPORTED, type BankCountry, type SupportedSource } from "./sheet";
import { FAQ, SOURCE_LICENSE, type FaqItem } from "./site";

/** Icons available to the sections (same library as the app: lucide). The component maps the name to the icon. */
export type HomeIcon =
  | "gift" | "server" | "landmark" | "download" | "code"
  | "link" | "dashboard" | "calculator"
  | "backpack" | "scale" | "stamp" | "landmark-gov" | "umbrella" | "house"
  | "wallet" | "trending" | "card" | "user" | "shield" | "pie"
  | "key" | "eye" | "ban" | "sliders" | "file-text" | "database" | "pencil" | "chart"
  | "candles" | "layers" | "bitcoin" | "car" | "spreadsheet";

export interface HeroText {
  /** The statement, as two lines (each line is set on its own row, never a third). */
  title: readonly [string, string];
  /** Changes with the visitor's rules: no pension outside Italy, no taxes where no rules exist yet. */
  lede: ByRules;
  cta: string;
  /** Secondary button towards the public demo of the app. */
  demo: string;
}

/** The opening: one promise in two lines, one sentence, the button and the demo. */
export const HERO = {
  title: ["Tutti i tuoi soldi,", "in un numero solo."],
  lede: {
    full: "Conto, investimenti, pensione e mutuo insieme. Aggiornato ogni giorno, tasse comprese.",
    de: "Conto, investimenti e mutuo insieme. Aggiornato ogni giorno, tasse comprese.",
    none: "Conto, investimenti e mutuo insieme. Aggiornato ogni giorno.",
  },
  cta: "Inizia gratis",
  demo: "Prova la demo",
} as const satisfies HeroText;

export type SumTone = "neg";

export interface SumRow {
  /** The place, in everyday words (the app says Liquidità, Investimenti, Previdenza, Debiti). */
  label: string;
  /** How many: accounts, positions, funds, loans. */
  detail: string;
  /** Rounded value in euro, as the Panoramica sidebar shows it. */
  value: number;
  tone?: SumTone;
  /** Hidden, with its place, for visitors whose country lacks these rules; the total then leaves it out. */
  needs?: RuleNeed;
}

export interface SumText {
  title: string;
  rows: readonly SumRow[];
  /** Currency written before the total (English); Italian writes it after, inside `cents`. */
  prefix?: string;
  /** Decimals of the total, as in the screenshot (the rows are rounded). */
  cents: string;
  /** Currency written after a row's figure (Italian); English writes it before with `prefix`. */
  suffix?: string;
  /** Under the list: what the visitor can do with the amounts. */
  hint: string;
  /** Button that puts the sample figures back. */
  reset: string;
  /** `aria-label` of each amount field, `{place}` replaced by the row label. */
  fieldLabel: string;
}

/** The sum in the opening: the four places add up to the net worth of the Panoramica screenshot beside it. */
export const SUM = {
  title: "Patrimonio netto",
  rows: [
    { label: "Conti in banca", detail: "3 conti", value: 22595 },
    { label: "Investimenti", detail: "3 titoli", value: 35389 },
    { label: "Fondo pensione", detail: "1 fondo", value: 11082, needs: "pension" },
    { label: "Mutuo e prestiti", detail: "3 debiti", value: -39937, tone: "neg" },
  ] satisfies readonly SumRow[],
  cents: ",53 €",
  suffix: " €",
  hint: "Scrivi i tuoi importi: il conto si rifà da solo e niente esce da questa pagina.",
  reset: "Rimetti i dati d'esempio",
  fieldLabel: "Importo di {place}",
} as const satisfies SumText;

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

export interface PlacesText {
  /** «Da quattro posti», or three where the pension fund is hidden. */
  title: ByRules;
  intro: string;
  items: readonly SourceItem[];
  /** Countries whose banks can be linked (flags), with the name in the page language. */
  banks: readonly BankCountry[];
  brokers: readonly SupportedSource[];
  /** Dashed tile after the broker logos. */
  anyCsv: string;
  /** `aria-label` of the flags. */
  banksLabel: string;
}

/** «Da quattro posti, un numero»: how each place gets in, once; the rows carry the amounts of `SUM`, in the same order. */
export const PLACES = {
  title: { full: "Da quattro posti, un numero.", de: "Da tre posti, un numero." },
  intro: "Ogni cosa entra una volta. Poi l'app la tiene aggiornata da sola.",
  items: [
    {
      name: "La banca",
      hook: "Carichi l'estratto conto. L'app lo legge.",
      text: "CSV o Excel di qualsiasi banca, anche in un formato nuovo, con la categoria già messa. Il collegamento diretto alla banca, in sola lettura, arriva presto.",
      spec: "CSV ed Excel di qualsiasi banca · le categorie della banca, se il file le ha · collegamento Open Banking (PSD2) in arrivo",
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
  banks: SUPPORTED.countries,
  brokers: SUPPORTED.brokers,
  anyCsv: "qualsiasi CSV",
  banksLabel: "Paesi delle banche del collegamento in arrivo",
} as const satisfies PlacesText;

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
  /** Tab and panel hidden for visitors whose country lacks these rules. */
  needs?: RuleNeed;
}

export interface ShowcaseText {
  title: string;
  tabs: readonly ShowcaseTab[];
  /** `aria-label` of the tab list. */
  tabsLabel: string;
  /** Below the tabs: the whole gallery. */
  all: string;
  allHref: string;
}

/** «Cosa ti dice, ogni giorno»: five things the number knows, each with the real screen and its figure. */
export const SHOWCASE = {
  title: "Cosa ti dice, ogni giorno.",
  tabs: [
    {
      id: "spese",
      tab: "Spese",
      title: "Dove vanno i soldi, senza scrivere niente.",
      text: "Carichi l'estratto conto della banca. L'app divide i movimenti in quattro gruppi e ti chiede solo quando ha un dubbio.",
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
      figure: { value: "2046", caption: "tra 19,2 anni, ai ritmi di oggi" },
      shot: "analitiche",
      needs: "pension",
    },
  ] satisfies readonly ShowcaseTab[],
  tabsLabel: "Schermate",
  all: "Tutte le schermate",
  allHref: CONTENT_PATHS.schermate,
} as const satisfies ShowcaseText;

export interface TaxSpecimen {
  /** The figure, set huge; `small` follows it at body size. */
  value: string;
  small: string;
  /** What the figure is, above it. */
  caption: string;
}

export interface TaxText {
  title: string;
  text: string;
  specimens: readonly [TaxSpecimen, TaxSpecimen];
  more: { href: string; label: string };
}

/** «Il netto, prima di vendere»: the sample ETF today and what is left after the tax on a sale (the Tasse screenshot). */
export const TAX = {
  title: "Il netto, prima di vendere.",
  text: "26% sui guadagni, 12,5% sui titoli di Stato, le perdite degli anni scorsi che abbassano il conto, il bollo. L'app fa la stima prima che tu venda; il conto finale lo fa il broker.",
  specimens: [
    { caption: "Incassi se vendi oggi l'ETF d'esempio", value: "19.772", small: ",18 €" },
    { caption: "Ti resta, dopo 146,93 € di tasse", value: "19.625", small: ",25 €" },
  ],
  more: { href: CONTENT_PATHS.zainetto, label: "Prova il calcolatore, senza account" },
} as const satisfies TaxText;

export interface TrustFact {
  title: string;
  text: string;
  /** Three plain words that name how it is done (a law, a place, a format); one may link to its source. */
  terms: readonly string[];
  source?: Source;
}

export interface TrustText {
  /** The heading, in three short lines (the middle one sits flush right). */
  title: readonly [string, string, string];
  /** Two sentences under the heading: what the app can and cannot do with the accounts. */
  lede: string;
  /** What happens to the data, then what the project cannot promise: one row each, told apart by tone only. */
  facts: readonly TrustFact[];
  more: string;
  moreHref: string;
}

/**
 * «Cosa fa l'app con i tuoi dati»: four facts and one row of limits, said plainly. Every sentence is verified in
 * `security.ts`.
 */
export const TRUST = {
  title: ["Cosa fa", "l'app con", "i tuoi dati"],
  lede: "Legge i tuoi conti per mostrartene i numeri. Non può spostare soldi né fare pagamenti.",
  facts: [
    {
      title: "La password della banca resta alla banca.",
      text: "Non te la chiediamo mai. Il collegamento alla banca, in arrivo, potrà solo leggere: la password la scriverai solo sul suo sito e lo toglierai quando vuoi.",
      terms: ["Sola lettura", "Revocabile"],
      source: { label: "PSD2, art. 67", href: SECURITY_SOURCES.psd2.href },
    },
    {
      title: "I dati stanno in Germania.",
      text: FIELD_ENCRYPTION_LIVE
        ? "Connessioni cifrate; descrizioni e note dei movimenti cifrate anche nel database. Copie di sicurezza in Europa per 14 giorni."
        : "Connessioni cifrate. Copie di sicurezza in Europa per 14 giorni.",
      terms: FIELD_ENCRYPTION_LIVE ? ["Server in Germania", "Copie nell'UE", "AES-256"] : ["Server in Germania", "Copie nell'UE"],
    },
    {
      title: "Niente pubblicità, niente vendita di dati.",
      text: "Le statistiche d'uso sono anonime e senza cookie, sui nostri server.",
      terms: ["Senza cookie", "Anonime", "Sui nostri server"],
    },
    {
      title: "Porti via tutto quando vuoi.",
      text: "Un file ZIP con tutti i dati, oppure elimini l'account: subito, o con 30 giorni per ripensarci.",
      terms: ["ZIP", "JSON e CSV", "30 giorni"],
    },
    {
      title: "Quello che non promettiamo.",
      text: "Il server legge i dati per fare i conti, quindi chi gestisce il servizio potrebbe vederli. È un progetto piccolo: niente certificazioni né controlli esterni, il codice aperto è il modo per controllare.",
      terms: ["Nessuna ISO 27001", "Codice aperto"],
    },
  ] satisfies readonly TrustFact[],
  more: "Tutta la sicurezza, con le fonti",
  moreHref: CONTENT_PATHS.sicurezza,
} as const satisfies TrustText;

export interface HoodFact {
  label: string;
  value: string;
  /** Path in the repository, relative to `SOURCE_URL`; shown as a link only when the repository is public. */
  path?: string;
}

export interface HoodText {
  title: string;
  text: string;
  /** Text shown instead of `text` when the build has no public repository URL. */
  fallback: string;
  cta: string;
  selfHost: string;
  selfHostPath: string;
  command: { label: string; lines: readonly string[]; copy: string; copied: string };
  who: string;
  whoTail: string;
  facts: readonly HoodFact[];
}

/** «Sotto il cofano»: the technical facts, for whoever wants to read the code or run it at home. */
export const UNDER_HOOD = {
  title: "Il codice è aperto.",
  text: "Tutta l'app è pubblica, con licenza AGPL-3.0. Puoi leggere come tratta i dati, segnalare un problema o farla girare su un server tuo con Docker.",
  fallback: `Il codice ha licenza ${SOURCE_LICENSE} e si installa su un server tuo con Docker.`,
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
    { label: "Banca", value: "CSV ed Excel oggi; Open Banking (PSD2) in sola lettura in arrivo" },
    ...(FIELD_ENCRYPTION_LIVE ? [{ label: "Nel database", value: "Descrizioni e note cifrate (AES-256)" }] : []),
    { label: "I tuoi dati", value: "Export ZIP in JSON e CSV, cancellazione dall'app" },
    { label: "Accesso", value: "Link via email o Google, nessuna password" },
    { label: "Sicurezza", value: "SECURITY.md", path: "/blob/main/SECURITY.md" },
  ] satisfies readonly HoodFact[],
} as const satisfies HoodText;

export const FAQ_HOME = { title: "Prima di iscriverti." } as const;

export interface CloseText {
  title: string;
  /** One sentence on the closing's bottom row, before the demo link. */
  note: string;
  cta: string;
  demo: string;
  /** Optional plain button towards the calculators (Italian only). */
  tools?: string;
}

export const CLOSE = {
  title: "Il tuo numero, da domani mattina.",
  note: "Vuoi guardare prima? La demo è l'account di Giulia, senza iscriverti.",
  cta: "Inizia gratis",
  demo: "Prova la demo",
  tools: "Prova un calcolatore",
} as const satisfies CloseText;

/** Everything the home sections show, in one language: the components take it as a prop (`HOME_IT`, `HOME_EN`). */
export interface HomeContent {
  locale: Locale;
  hero: HeroText;
  sum: SumText;
  places: PlacesText;
  showcase: ShowcaseText;
  tax: TaxText;
  trust: TrustText;
  hood: HoodText;
  faq: { title: string; items: readonly FaqItem[] };
  close: CloseText;
}

export const HOME_IT: HomeContent = {
  locale: "it",
  hero: HERO,
  sum: SUM,
  places: PLACES,
  showcase: SHOWCASE,
  tax: TAX,
  trust: TRUST,
  hood: UNDER_HOOD,
  faq: { title: FAQ_HOME.title, items: FAQ },
  close: CLOSE,
};

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
