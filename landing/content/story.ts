/**
 * Testi e numeri della home «Sei domande» (decisione 2026-10-14, `docs/decisioni/2026-10-14-landing-sei-domande.md`):
 * una finestra dell'app che resta ferma e risponde a sei domande mentre si scorre. Dove la schermata non racconta
 * abbastanza, la finestra mostra l'app che lavora (pannelli «vivi» in HTML) e un pulsante apre la schermata vera.
 * Le cifre sono quelle dei dati d'esempio degli screenshot (`scripts/demo-seed.ts`), non di nessuno. Texts are in
 * plain words (decision of 2026-10-15): short sentences, one idea each, no acronyms, technical terms only if explained.
 */
import type { HomeIcon } from "./home";
import type { ScreenId } from "./screens";
import { CONTENT_PATHS } from "./seo-pages";
import { FIELD_ENCRYPTION_LIVE, SECURITY_SOURCES } from "./security";
import { SUPPORTED } from "./sheet";
import type { Source } from "./seo-pages";

/** Dominio mostrato nella barra della finestra (solo testo: l'app vera sta su `APP_URL`). */
export const APP_HOST = "app.buddybudget.io";

/** Gruppi di spesa dell'app, con il colore del token (`--g-*` in `globals.css`, gli stessi di `--group-*` nell'app). */
export type SpendGroup = "dovuta" | "voluta" | "futuro" | "saltuaria";
export const GROUPS: readonly { id: SpendGroup; label: string }[] = [
  { id: "dovuta", label: "Dovute" },
  { id: "voluta", label: "Volute" },
  { id: "futuro", label: "Te futuro" },
  { id: "saltuaria", label: "Saltuarie" },
];

/**
 * Strumento d'esempio nei chip «funziona con»: nome, tipo e riquadro. Se ha un `logo` (file in `public/`, scaricato
 * con `scripts/fetch-market-logos.mjs`) il riquadro mostra quello; altrimenti l'`icona` nel colore dell'app (vedi `story.css`).
 */
export interface InstrumentChip {
  icon: HomeIcon;
  name: string;
  kind?: string;
  color: "sal" | "primary" | "ink" | "vol" | "fut" | "neg" | "mut";
  logo?: string;
}

export const INSTRUMENTS: readonly InstrumentChip[] = [
  { icon: "candles", name: "Enel", kind: "azione", color: "sal", logo: "/logos/market/enel.webp" },
  { icon: "layers", name: "VWCE", kind: "ETF", color: "primary", logo: "/logos/market/vanguard.webp" },
  { icon: "landmark-gov", name: "BTP 2030", kind: "12,5%", color: "ink", logo: "/logos/market/mef.webp" },
  { icon: "bitcoin", name: "Bitcoin", color: "vol", logo: "/logos/market/bitcoin.webp" },
  { icon: "umbrella", name: "Fondo pensione", color: "fut" },
  { icon: "house", name: "Mutuo", color: "neg" },
];

export const HERO = {
  title: "Sei domande sui tuoi soldi.",
  lede: "Dove vanno? Quanto rendono? Quante tasse pago se vendo? Conviene chiudere il mutuo prima? Quando posso smettere di lavorare? E in tutto, quanto ho? BuddyBudget mette insieme banca, broker, mutuo e fondo pensione e risponde ogni giorno, con le tasse italiane già fatte.",
  cta: "Crea un account gratis",
  scroll: "Scorri le domande",
  /** Fatti veri oggi e controllabili (codice, informativa, impostazioni). */
  facts: ["Gratis durante la beta", "Banca in sola lettura", "Server in Germania"],
  with: {
    label: "Funziona con",
    banks: "le banche di cinque paesi, in sola lettura",
    brokers: "e i file di qualunque broker",
  },
  shot: "panoramica" satisfies ScreenId,
  url: `${APP_HOST}/panoramica`,
  caption: "La prima schermata, con i dati di una persona inventata.",
} as const;

export type StoryStepId = "soldi" | "investimenti" | "titolo" | "tasse" | "mutuo" | "futuro" | "totale";
export type LivePanelId = "movimenti" | "performance" | "tasse" | "debiti" | "analitiche";

export interface StoryAmount {
  value: string;
  /** Decimali o unità, più piccoli e attenuati (es. «,00 €» o «%»). */
  small?: string;
  tone?: "pos" | "neg";
}

export interface StoryStep {
  id: StoryStepId;
  /** «1 di 6»; assente nel passo secondario del titolo. */
  n?: string;
  title: string;
  text: string;
  amount: StoryAmount;
  caption: string;
  more?: { href: string; label: string };
  /** Pannello vivo mostrato nella finestra (l'app che lavora) oppure la schermata vera. */
  live?: LivePanelId;
  /** Schermata vera: quella mostrata, o quella dietro «Vedi la schermata vera» quando c'è un pannello vivo. */
  shot: ScreenId;
  /** Riquadro su cui si avvicina la camera, in pixel dello screenshot a 1920 px: x, y, larghezza, altezza. */
  focus?: readonly [number, number, number, number];
  /** Indirizzo nella barra della finestra mentre c'è il pannello vivo. */
  url: string;
  /** Didascalia sotto la finestra. */
  stageCaption: string;
}

export const STEPS: readonly StoryStep[] = [
  {
    id: "soldi",
    n: "1 di 6",
    title: "Dove vanno i soldi ogni mese?",
    text: "Le spese arrivano dalla banca da sole. L'app le mette in quattro gruppi: quelle che devi pagare, quelle che ti concedi, quelle per il futuro, quelle rare. Tu guardi solo i dubbi.",
    amount: { value: "2.053", small: ",00 €" },
    caption: "spesi a ottobre, finora · Dovute 1.102 € · Volute 486 € · Te futuro 300 € · Saltuarie 165 €",
    more: { href: CONTENT_PATHS.funzioni, label: "Tutto su conti e spese" },
    live: "movimenti",
    shot: "analisi",
    url: `${APP_HOST}/liquidita`,
    stageCaption: "Le spese di ottobre nei quattro gruppi. Lo fa l'app.",
  },
  {
    id: "investimenti",
    n: "2 di 6",
    title: "Come vanno i miei investimenti?",
    text: "Quanto hai guadagnato davvero, tolti i soldi che hai versato tu. Mese per mese, a confronto con il mercato.",
    amount: { value: "+1,6", small: "%", tone: "pos" },
    caption: "negli ultimi tre mesi, tolti i versamenti · luglio +0,8 · agosto +0,9 · settembre +0,5 · ottobre −0,7",
    live: "performance",
    shot: "performance",
    focus: [370, 440, 1000, 310],
    url: `${APP_HOST}/investimenti/performance`,
    stageCaption: "Quanto vale il portafoglio e quanto ci hai messo tu: la distanza è il guadagno.",
  },
  {
    id: "titolo",
    title: "E un titolo alla volta.",
    text: "Ogni azione, ETF o BTP ha la sua pagina: prezzo, andamento, rischio, quanto ci stai guadagnando. Per le azioni anche i conti dell'azienda. Per gli ETF, cosa c'è dentro.",
    amount: { value: "+32,8", small: "%", tone: "pos" },
    caption: "Energia Italia in un anno · tu ci stai guadagnando il 27,5%",
    more: { href: CONTENT_PATHS.funzioneInvestimenti, label: "Tutto sugli investimenti" },
    shot: "titolo",
    focus: [370, 170, 1000, 240],
    url: `${APP_HOST}/investimenti/titoli/energia-italia`,
    stageCaption: "La pagina di un titolo: prezzo, andamento, rischio e la tua posizione.",
  },
  {
    id: "tasse",
    n: "3 di 6",
    title: "Quante tasse pago se vendo?",
    text: "Scegli cosa vendere. Vedi subito le tasse e quanto ti resta, con le regole italiane: 26% sui guadagni, 12,5% sui titoli di Stato, perdite degli anni scorsi scalate. È una stima: il conto vero lo fa la banca.",
    amount: { value: "148", small: ",64 €" },
    caption: "di tasse se vendi tutto l'ETF d'esempio · ti restano 19.630,11 €",
    more: { href: CONTENT_PATHS.zainetto, label: "Prova il calcolatore delle tasse, senza account" },
    live: "tasse",
    shot: "tasse",
    focus: [370, 960, 1020, 500],
    url: `${APP_HOST}/investimenti/tasse`,
    stageCaption: "Il conto se vendi oggi, riga per riga.",
  },
  {
    id: "mutuo",
    n: "4 di 6",
    title: "Conviene chiudere il mutuo prima?",
    text: "Scrivi quanto puoi pagare in più al mese. Vedi quando finisci e quanti interessi risparmi. I soldi in più vanno prima sul debito che costa di più.",
    amount: { value: "3 anni e 2 mesi" },
    caption: "prima, con 200 € in più al mese · 1.708 € di interessi risparmiati · senza debiti da luglio 2030",
    more: { href: CONTENT_PATHS.ammortamento, label: "Prova il calcolatore del mutuo, senza account" },
    live: "debiti",
    shot: "debiti",
    focus: [1290, 390, 620, 720],
    url: `${APP_HOST}/debiti`,
    stageCaption: "Gli stessi debiti, con e senza 200 € in più al mese.",
  },
  {
    id: "futuro",
    n: "5 di 6",
    title: "Quando posso smettere di lavorare?",
    text: "Parte da quanto risparmi e spendi davvero. Muovi un cursore e l'anno cambia. Vale anche per un viaggio o l'anticipo di una casa.",
    amount: { value: "2045" },
    caption: "tra 18,8 anni, se continui così · i numeri di partenza sono sempre sotto i cursori",
    more: { href: CONTENT_PATHS.funzioni, label: "Tutto sul futuro" },
    live: "analitiche",
    shot: "analitiche",
    focus: [370, 130, 1000, 330],
    url: `${APP_HOST}/analitiche`,
    stageCaption: "Muovi un cursore e l'anno cambia: qui con 200 € in più al mese.",
  },
  {
    id: "totale",
    n: "6 di 6",
    title: "E in tutto, quanto ho?",
    text: "Tutto quello che hai, meno i debiti. Si aggiorna ogni giorno da solo.",
    amount: { value: "29.282", small: ",74 €" },
    caption: "quello che hai, meno quello che devi",
    shot: "panoramica",
    focus: [390, 1160, 860, 440],
    url: `${APP_HOST}/panoramica`,
    stageCaption: "La Panoramica: le quattro voci, sommate.",
  },
];

/** Le voci del patrimonio nell'ultimo passo, come nella Panoramica. */
export const LEDGER = {
  rows: [
    { label: "Liquidità · 3 conti", value: "22.706,19 €" },
    { label: "Investimenti · 3 posizioni", value: "35.431,71 €" },
    { label: "Previdenza · 1 fondo", value: "11.082,07 €" },
    { label: "Debiti · 3 debiti", value: "−39.937,23 €", tone: "neg" as const },
  ],
  total: { label: "Patrimonio netto", value: "29.282,74 €" },
} as const;

/** Un movimento nel pannello «dove vanno i soldi»: finisce nel suo gruppo mentre si guarda. */
export interface Movement {
  name: string;
  amount: string;
  group: SpendGroup;
}

export const MOVEMENTS_PANEL = {
  title: "Movimenti di ottobre",
  subtitle: "15 dalla banca · spesi",
  total: "2.053,00 €",
  inbox: "Appena arrivati, ancora senza gruppo",
  groups: [
    { id: "dovuta", total: "1.102 €", share: 54 },
    { id: "voluta", total: "486 €", share: 24 },
    { id: "futuro", total: "300 €", share: 15 },
    { id: "saltuaria", total: "165 €", share: 8 },
  ] satisfies readonly { id: SpendGroup; total: string; share: number }[],
  movements: [
    { name: "Affitto · Rossi Immobiliare", amount: "650,00", group: "dovuta" },
    { name: "Weekend a Bologna", amount: "188,00", group: "voluta" },
    { name: "Esselunga", amount: "237,60", group: "dovuta" },
    { name: "PAC · VWCE", amount: "250,00", group: "futuro" },
    { name: "Zara", amount: "79,95", group: "voluta" },
    { name: "Enel Energia", amount: "92,00", group: "dovuta" },
    { name: "Dentista", amount: "120,00", group: "saltuaria" },
    { name: "Ristorante Da Mario", amount: "64,00", group: "voluta" },
    { name: "Trenitalia", amount: "68,00", group: "dovuta" },
    { name: "Amazon", amount: "96,06", group: "voluta" },
    { name: "Fondo pensione", amount: "50,00", group: "futuro" },
    { name: "Farmacia", amount: "54,40", group: "dovuta" },
    { name: "Palestra", amount: "45,00", group: "voluta" },
    { name: "Regalo di compleanno", amount: "45,00", group: "saltuaria" },
    { name: "Netflix", amount: "12,99", group: "voluta" },
  ] satisfies readonly Movement[],
  /** Riga di stato in fondo: da dove arriva ogni categoria. */
  status: [
    { tone: "primary", count: "12", text: "messi dall'app" },
    { tone: "pos", count: "2", text: "con una regola tua" },
    { tone: "none", count: "1", text: "da decidere: Regalo di compleanno" },
  ] satisfies readonly { tone: "primary" | "pos" | "none"; count: string; text: string }[],
  /** Sul telefono: la lista corta sotto le quattro barre. */
  phoneTitle: "Ottobre, finora",
  phoneSubtitle: "15 movimenti dalla banca · 2.053,00 €",
  phoneMovements: [
    { name: "Affitto", amount: "650,00", group: "dovuta" },
    { name: "PAC · VWCE", amount: "250,00", group: "futuro" },
    { name: "Esselunga", amount: "237,60", group: "dovuta" },
    { name: "Weekend a Bologna", amount: "188,00", group: "voluta" },
    { name: "Dentista", amount: "120,00", group: "saltuaria" },
    { name: "Netflix", amount: "12,99", group: "voluta" },
  ] satisfies readonly Movement[],
} as const;

export const PERFORMANCE_PANEL = {
  title: "Investimenti · Performance",
  subtitle: "ultimi 3 mesi · 14 lug – 14 ott 2026",
  /** Punti del grafico (viewBox 480×262): quanto vale e quanto hai versato. */
  valuePath: "M10,214 C40,204 80,188 120,178 C150,170 190,146 235,146 C260,146 300,124 350,128 C380,130 420,142 450,150",
  paidPath: "M10,216 L120,216 L120,200 L235,200 L235,184 L350,184 L350,168 L450,168",
  areaPath: "M10,216 L120,216 L120,200 L235,200 L235,184 L350,184 L350,168 L450,168 L450,150 C420,142 380,130 350,128 C300,124 260,146 235,146 C190,146 150,170 120,178 C80,188 40,204 10,214 Z",
  axis: [
    { x: 10, label: "lug" },
    { x: 120, label: "ago" },
    { x: 235, label: "set" },
    { x: 350, label: "ott" },
  ],
  legend: { value: "quanto vale", paid: "versato", paidLong: "quello che hai " },
  kpis: [
    { label: "Guadagno del periodo", value: "+1,6 %", tone: "pos" as const },
    { label: "Valore oggi", value: "35.432 €" },
    { label: "Versato in tutto", value: "33.509 €" },
  ],
  months: [
    { short: "lug", rest: "lio", value: "+0,8 %", tone: "pos" as const },
    { short: "ago", rest: "sto", value: "+0,9 %", tone: "pos" as const },
    { short: "set", rest: "tembre", value: "+0,5 %", tone: "pos" as const },
    { short: "ott", rest: "obre", value: "−0,7 %", tone: "neg" as const },
  ],
  status: "La distanza tra le due linee è il guadagno vero.",
} as const;

export const TAX_PANEL = {
  title: "Prima di vendere",
  subtitle: "ETF Azionario Globale Demo",
  quantity: "200,24 quote",
  rows: [
    { label: "Incasso al prezzo di oggi", value: "19.778,75 €" },
    { label: "Quanto hai pagato", detail: "(prezzo medio)", value: "19.207,05 €" },
    { label: "Guadagno", value: "+571,69 €", tone: "pos" as const, kind: "sum" as const },
    { label: "Perdite da scalare", detail: "degli anni scorsi", value: "0,00 €" },
    { label: "Tasse · 26 %", detail: "sul guadagno", value: "−148,64 €", tone: "neg" as const },
    { label: "Ti resta", value: "19.630,11 €", kind: "total" as const },
  ],
  status: "Stima con le regole italiane. Il conto vero lo fa la tua banca.",
} as const;

export const DEBT_PANEL = {
  title: "Debiti · E se pagassi di più?",
  subtitle: "3 debiti ·",
  residual: "39.937 €",
  residualTail: "residui",
  slider: { label: "In più ogni mese", from: 0, to: 200, position: 0, positionAfter: 40 },
  bars: {
    today: { label: "Come oggi", width: 92, end: "settembre 2033" },
    extra: { label: "Con 200 € in più", width: 92, widthAfter: 49, end: "settembre 2033", endAfter: "luglio 2030" },
    axis: [
      { at: 0, label: "oggi" },
      { at: 53, label: "2030" },
      { at: 92, label: "2033" },
    ],
  },
  results: {
    when: { label: "Chiudi tutto", before: "come oggi", after: "3 anni e 2 mesi prima" },
    saved: { label: "Interessi risparmiati", from: 0, to: 1708 },
  },
  order: [
    { name: "Cucina e lavatrice · 12,6 %", detail: "1.566 € · i soldi in più vanno prima qui" },
    { name: "Prestito auto · 7,1 %", detail: "10.938 €" },
    { name: "Mutuo casa · 2,9 %", detail: "27.434 € · per ultimo" },
  ],
  status: "I soldi in più vanno prima sul debito che costa di più: le rate della cucina, poi il prestito, infine il mutuo.",
} as const;

export const FIRE_PANEL = {
  title: "Analitiche · Quando posso smettere?",
  subtitle: "risparmio, spesa e rendimento",
  subtitleStrong: "dai tuoi ultimi 12 mesi",
  year: { label: "Puoi smettere di lavorare intorno al", from: 2045, to: 2044, before: "tra 18,8 anni", after: "tra 17,3 anni · 1,4 anni prima" },
  chart: {
    fireLabel: "ti servono 757.022 €",
    todayLabel: "oggi · 29.283 €",
    basePath: "M10,150 C120,146 230,120 320,86 C360,70 400,52 440,34",
    extraPath: "M10,150 C110,144 220,114 305,82 C345,66 380,50 408,34",
    baseYear: { x: 440, label: "2045" },
    extraYear: { x: 408, label: "2044" },
  },
  sliders: [
    { label: "Risparmio al mese", from: 426, to: 626, position: 30, positionAfter: 46, counter: true },
    { label: "Spesa all'anno", value: "26.278 €", position: 52 },
    { label: "Rendimento", value: "11,6 %", position: 58, phoneHidden: true },
    { label: "Quanto prelevi", value: "3,5 %", position: 35, phoneHidden: true },
  ],
  answers: [
    { label: "Strada fatta", value: "8 %" },
    { label: "L'anno di arrivo", year: true },
    { label: "Quanto costa", value: "71 € l'anno" },
    { label: "Risparmio al mese", savings: true },
  ],
} as const;

/** Pulsante sotto la finestra, per i passi con un pannello vivo. */
export const REAL_TOGGLE = { show: "Vedi la schermata vera", hide: "Torna all'animazione" } as const;

/** «Com'è fatta» ("How it looks"): the gallery of every screen, after the six questions. */
export const SCREENS_HOME = {
  title: "Com'è fatta, schermata per schermata.",
  intro: "Schermate vere, intere, con i dati di una persona inventata. Scegli quale vedere.",
} as const;

/** «Funziona con quello che hai già»: le quattro famiglie di fonti. */
export const WORKS_WITH = {
  title: "Funziona con quello che hai già.",
  intro: "La banca si collega e può solo leggere. Dal broker carichi un file. Del fondo pensione bastano due numeri. Niente da riscrivere a mano.",
  banks: {
    icon: "landmark" satisfies HomeIcon,
    title: "Le banche di cinque paesi",
    text: "Italia, Germania, Francia, Spagna e Regno Unito. Il collegamento passa da GoCardless, un servizio autorizzato in Europa che può solo leggere. La password la scrivi solo sul sito della tua banca. Il consenso dura 90 giorni.",
  },
  brokers: {
    icon: "spreadsheet" satisfies HomeIcon,
    title: "I file del broker",
    text: "Interactive Brokers, DEGIRO, Trade Republic e Fineco si leggono subito. Per gli altri, l'app impara il formato dal tuo file. Nessun accesso al conto titoli.",
    csv: "CSV di chiunque",
  },
  instruments: {
    icon: "trending" satisfies HomeIcon,
    title: "Azioni, ETF, titoli di Stato, cripto",
    text: "Ogni strumento ha la sua pagina e la sua tassa. I prezzi arrivano tre volte al giorno, a fine giornata.",
    source: "Tra le fonti dei prezzi",
  },
  rest: {
    icon: "umbrella" satisfies HomeIcon,
    title: "Fondo pensione, mutuo e prestiti",
    text: "Del fondo pensione bastano quanto hai versato e quanto vale. Del mutuo importo, tasso e durata, una volta sola. Il resto lo calcola l'app.",
    chips: [
      { icon: "umbrella", name: "Fondo pensione", kind: "TFR a confronto", color: "fut" },
      { icon: "house", name: "Mutuo casa", color: "neg" },
      { icon: "car", name: "Prestito auto", color: "mut" },
    ] satisfies readonly InstrumentChip[],
  },
  countries: SUPPORTED.countries,
  brokerLogos: SUPPORTED.brokers,
} as const;

export interface SecurityRow {
  icon: HomeIcon;
  title: string;
  text: string;
  sources?: readonly Source[];
}

/** «La sicurezza, in chiaro»: ogni frase è verificata nel codice, nel repo infra o in una fonte citata (vedi `security.ts`). */
export const SECURITY_HOME = {
  title: "La sicurezza, in chiaro.",
  intro: "È la prima domanda di tutti, prima di collegare la banca. Ecco le risposte. Ogni frase si può controllare nel codice o nelle fonti.",
  rows: [
    {
      icon: "landmark",
      title: "PSD2, in due parole",
      text: "Una legge europea. Se lo chiedi tu, la banca fa leggere i tuoi conti a un servizio autorizzato. La password resta tua: la scrivi solo alla banca. Qui il servizio è GoCardless, autorizzato in Francia (ACPR, n. 17118): legge e basta, non può pagare. Il consenso scade dopo 90 giorni, o quando lo togli tu.",
      sources: [
        { label: "Direttiva (UE) 2015/2366, art. 67", href: SECURITY_SOURCES.psd2.href },
        { label: "Condizioni GoCardless, art. 4", href: SECURITY_SOURCES.gocardlessTerms.href },
      ],
    },
    {
      icon: "key",
      title: "Cosa è cifrato",
      text: FIELD_ENCRYPTION_LIVE
        ? "La connessione è sempre cifrata (HTTPS). Nel database, descrizioni e note dei movimenti, note di debiti e investimenti e chiavi della banca sono cifrate (AES-256) prima di essere salvate, con una chiave che non sta nei backup. Importi e date restano leggibili: servono per fare i conti."
        : "La connessione è sempre cifrata (HTTPS). Importi, date e descrizioni dei movimenti stanno nel database in chiaro, perché servono per fare i conti.",
    },
    {
      icon: "server",
      title: "Dove stanno i dati",
      text: "Su un server in Germania. Le copie di sicurezza restano in Europa per 14 giorni, cifrate. I registri tecnici durano 30 giorni, senza email, nomi, importi o descrizioni.",
      sources: [{ label: "Cloudflare R2, dati nell'Unione europea", href: SECURITY_SOURCES.r2Location.href }],
    },
    {
      icon: "ban",
      title: "Cosa non salviamo mai",
      text: "La password della banca: la dai solo alla banca. Una password per BuddyBudget: non esiste, entri con un link via email o con Google. L'IBAN: serve solo mentre scegli quale conto collegare.",
    },
    {
      icon: "download",
      title: "Cosa controlli tu",
      text: "Scollega la banca: il consenso sparisce subito. Scarica tutto in un file ZIP. Elimina l'account, subito o con 30 giorni per ripensarci.",
    },
  ] satisfies readonly SecurityRow[],
  moreLabel: "Tutta la pagina sulla sicurezza, con le fonti",
  limits: [
    {
      title: "Il server può leggere i dati",
      text: "Deve leggerli per fare i conti, quindi chi gestisce il servizio potrebbe vederli. Preferiamo dirlo.",
    },
    {
      title: "Nessuna certificazione",
      text: "È un progetto piccolo: niente certificazioni (ISO 27001) né controlli esterni. Il codice aperto, qui sotto, è il modo per controllare.",
    },
  ],
} as const;

/** Il codice aperto, con i fatti del repository. Compare solo con `NEXT_PUBLIC_SOURCE_URL`. */
export const OPEN_SOURCE = {
  title: "Il codice è aperto. Leggilo, o installalo sul tuo server.",
  text: "Tutta l'app è pubblica su GitHub (licenza AGPL-3.0). Puoi leggere come tratta i tuoi dati, segnalare un problema o installarla su un server tuo con Docker.",
  cta: "Vedi il codice su GitHub",
  selfHost: "Guida al self-hosting",
  /** Percorsi nel repository, relativi a `SOURCE_URL`. */
  selfHostPath: "/blob/main/docs/self-hosting.md",
  who: "Dietro c'è un progetto indipendente con sede a Torino. Scrivi a",
  whoTail: ": risponde una persona.",
  repoLabel: "pubblico",
  facts: [
    { label: "Licenza", value: "AGPL-3.0" },
    { label: "Linguaggio", value: "TypeScript" },
    { label: "Self-hosting", value: "Docker Compose", path: "/blob/main/docs/self-hosting.md" },
    { label: "Sicurezza", value: "SECURITY.md", path: "/blob/main/SECURITY.md" },
    { label: "Contribuire", value: "CONTRIBUTING.md", path: "/blob/main/CONTRIBUTING.md" },
  ],
} as const;

export const RULES_HOME = {
  title: "Le regole italiane sono già nei conti.",
  intro: "Sono stime per decidere. Il conto definitivo lo fa la banca, il broker o un professionista.",
} as const;

export const TOOLS_HOME = {
  title: "Prova senza account.",
  intro: "Gli stessi calcoli dell'app, aperti a tutti. Sono stime, con le fonti in fondo a ogni pagina.",
  open: "Apri il calcolatore",
} as const;

export const FAQ_HOME = { title: "Prima di iscriverti." } as const;

export const CLOSE = {
  title: "Sei domande. Le tue risposte, ogni giorno.",
  note: "Entri con un link via email o con Google. Nessuna password da ricordare.",
  cta: "Crea un account gratis",
  tools: "Prova un calcolatore",
} as const;
