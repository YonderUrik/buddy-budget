/**
 * Testi delle sezioni della home introdotte con la landing del 2026-10-09 (vedi `docs/decisioni/2026-10-09-landing-nuova-struttura.md`):
 * fatti sotto l'apertura, tre passi, regole italiane, metodo dei quattro gruppi, per chi è, confronto. Solo fatti
 * verificabili nel prodotto: niente numeri di utenti, recensioni o promesse. Le cifre di esempio sono dichiarate come tali.
 */
import type { ScreenId } from "./screens";
import { CONTENT_PATHS, SOURCES, type Source } from "./seo-pages";

/** Icone disponibili per le sezioni (stessa libreria dell'app: lucide). Il componente traduce il nome in icona. */
export type HomeIcon =
  | "gift" | "server" | "landmark" | "download" | "code"
  | "link" | "dashboard" | "calculator"
  | "backpack" | "scale" | "stamp" | "landmark-gov" | "umbrella" | "house";

export interface HeroFact {
  icon: HomeIcon;
  label: string;
}

/** Fatti sotto il pulsante d'apertura: ognuno è vero oggi e controllabile (codice, informativa, impostazioni). */
export const HERO_FACTS: readonly HeroFact[] = [
  { icon: "gift", label: "Gratis durante la beta" },
  { icon: "landmark", label: "Banca in sola lettura" },
  { icon: "server", label: "Server in Germania" },
  { icon: "download", label: "Esporti tutto in ZIP" },
];

/** Fatto aggiunto solo quando il codice è pubblico (`SOURCE_URL` valorizzato). */
export const OPEN_SOURCE_FACT: HeroFact = { icon: "code", label: "Codice aperto" };

export interface Step {
  icon: HomeIcon;
  title: string;
  text: string;
  /** Ritaglio di uno screenshot vero: schermata e punto in alto a sinistra (in % dello screenshot), con ingrandimento. */
  shot: { id: ScreenId; zoom: number; x: number; y: number };
}

export const STEPS = {
  title: "Come si comincia.",
  lede: "Dal primo conto alla prima decisione, senza dover inserire tutto il primo giorno.",
  steps: [
    {
      icon: "link",
      title: "Collega la banca o importa",
      text: "Il conto si collega in sola lettura con l'Open Banking. Le operazioni del broker arrivano dai file che già scarichi, per esempio da Interactive Brokers, DEGIRO, Trade Republic e Fineco.",
      shot: { id: "conti", zoom: 1.8, x: 20, y: 20 },
    },
    {
      icon: "dashboard",
      title: "Vedi il quadro intero",
      text: "Saldi di tutti i conti, spese del mese, portafoglio, fondo pensione e debiti residui, fino al patrimonio netto.",
      shot: { id: "movimenti", zoom: 1.8, x: 20, y: 19 },
    },
    {
      icon: "calculator",
      title: "Decidi con le cifre",
      text: "Quanto pagheresti vendendo oggi, quanto risparmi estinguendo una parte del mutuo, in che anno puoi smettere di lavorare.",
      shot: { id: "tasse", zoom: 1.75, x: 20, y: 19 },
    },
  ] satisfies readonly Step[],
} as const;

export interface ItalyRule {
  icon: HomeIcon;
  /** La regola, come la trovi scritta nelle guide. */
  rule: string;
  /** Cosa fa BuddyBudget con quella regola. */
  app: string;
  link?: { href: string; label: string };
  source?: Source;
}

/** Regole fiscali e bancarie italiane già calcolate dall'app. Le fonti sono le stesse delle pagine guida (`SOURCES`). */
export const ITALY = {
  kicker: "Fatto per l'Italia",
  title: "Le regole italiane, già nei conti.",
  lede: "Zainetto fiscale, aliquote, bollo, TFR: regole che un'app pensata per un altro paese non conosce. Qui entrano nei calcoli, come stime per decidere; il conteggio definitivo lo fanno l'intermediario o un professionista.",
  rules: [
    {
      icon: "backpack",
      rule: "Le minusvalenze si usano entro il quarto anno successivo.",
      app: "Tiene lo zainetto fiscale anno per anno e ti dice quanto scade e quando.",
      link: { href: CONTENT_PATHS.zainetto, label: "Calcolatore dello zainetto" },
      source: SOURCES.tuir68,
    },
    {
      icon: "scale",
      rule: "I guadagni sugli ETF armonizzati non si compensano con le perdite.",
      app: "Separa redditi di capitale e redditi diversi, così lo zainetto non promette compensazioni che non esistono.",
      link: { href: CONTENT_PATHS.guidaZainetto, label: "La guida, con esempi" },
      source: SOURCES.quadroRt,
    },
    {
      icon: "landmark-gov",
      rule: "I titoli di Stato pagano il 12,5%, il resto il 26%.",
      app: "Applica l'aliquota giusta a ogni operazione, BTP compresi.",
      source: SOURCES.circolare19e,
    },
    {
      icon: "stamp",
      rule: "Ogni anno si paga l'imposta di bollo sul deposito titoli.",
      app: "La stima sul valore del portafoglio, insieme all'imposta che pagheresti vendendo oggi.",
    },
    {
      icon: "umbrella",
      rule: "Fondo pensione e TFR in azienda hanno tasse diverse.",
      app: "Confronta gli stessi versamenti nei due casi e stima cosa ti resterebbe prelevando oggi.",
    },
    {
      icon: "house",
      rule: "Il mutuo per la casa si può estinguere in anticipo senza penali.",
      app: "Simula l'estinzione parziale: rata più bassa o durata più corta, e quanto risparmi di interessi.",
      link: { href: CONTENT_PATHS.ammortamento, label: "Calcolatore del piano di ammortamento" },
      source: SOURCES.guidaMutuo,
    },
  ] satisfies readonly ItalyRule[],
} as const;

export type SpendingGroupId = "dovute" | "volute" | "futuro" | "saltuarie" | "avanzo";

export interface SpendingGroup {
  id: SpendingGroupId;
  name: string;
  /** Importo di un mese di esempio, in euro. */
  amount: number;
  text: string;
}

/** Un mese di esempio diviso nei quattro gruppi di spesa dell'app, più l'avanzo (ciò che resta dopo i gruppi). */
export const GROUPS = {
  kicker: "Il metodo",
  title: "Le spese in quattro gruppi.",
  lede: "Le categorie restano, ma ognuna appartiene a uno di quattro gruppi. Basta un'occhiata per capire se il mese è andato come volevi.",
  income: 2400,
  incomeLabel: "Entrate del mese",
  groups: [
    { id: "dovute", name: "Dovute", amount: 1150, text: "Affitto o rata, bollette, spesa, trasporti: ciò che paghi comunque." },
    { id: "volute", name: "Volute", amount: 420, text: "Ristoranti, viaggi, abbonamenti: ciò che scegli." },
    { id: "futuro", name: "Te futuro", amount: 480, text: "Risparmio, investimenti, fondo pensione: ciò che metti da parte." },
    { id: "saltuarie", name: "Saltuarie", amount: 150, text: "Regali, auto, spese mediche: ciò che non arriva ogni mese." },
    { id: "avanzo", name: "Avanzo", amount: 200, text: "Ciò che resta dopo i gruppi." },
  ] satisfies readonly SpendingGroup[],
  note: "Cifre di un mese di esempio.",
} as const;

/** Per chi è e per chi no: due colonne oneste, per non far registrare chi non troverebbe ciò che cerca. */
export const FIT = {
  title: "Fa per te?",
  yesTitle: "Sì, se",
  yes: [
    "hai conti, investimenti e magari un mutuo sparsi in posti diversi",
    "investi in ETF o BTP e vuoi sapere quanto pagheresti di tasse prima di vendere",
    "hai un fondo pensione e non sai se rende più del TFR",
    "oggi tieni i conti su un foglio Excel e ti costa tempo aggiornarlo",
  ],
  noTitle: "No, se",
  no: [
    "cerchi consigli su cosa comprare: BuddyBudget non fa consulenza",
    "vuoi pagare o investire dall'app: non è una banca né un broker",
    "vivi fuori dall'Italia o usi un'altra valuta: per ora è in italiano e in euro",
    "vuoi un'app dagli store: si usa dal browser e si installa sulla schermata Home",
  ],
} as const;

export type CompareValue = "si" | "no" | "parziale";

export interface CompareRow {
  label: string;
  /** Foglio di calcolo, app di sola spesa, BuddyBudget: valore e breve spiegazione. */
  cells: readonly [readonly [CompareValue, string], readonly [CompareValue, string], readonly [CompareValue, string]];
}

/** Confronto con le due alternative più comuni, senza nominare marchi: un foglio di calcolo e un'app che traccia solo le spese. */
export const COMPARE = {
  title: "Foglio di calcolo, app di spese o BuddyBudget.",
  lede: "Le due alternative più comuni vanno bene entrambe. La differenza sta in quanto vuoi tenere insieme.",
  columns: ["Foglio di calcolo", "App di sole spese", "BuddyBudget"] as const,
  rows: [
    { label: "Movimenti dalla banca", cells: [["no", "copiati a mano"], ["parziale", "dipende dall'app"], ["si", "Open Banking, in sola lettura"]] },
    { label: "Categorie che si ricordano i negozi", cells: [["no", "a mano"], ["si", "di solito"], ["si", "regole che vedi e modifichi"]] },
    { label: "Investimenti con le tasse italiane", cells: [["parziale", "se scrivi le formule"], ["no", ""], ["si", "zainetto, bollo, aliquote"]] },
    { label: "Fondo pensione e TFR", cells: [["parziale", "se scrivi le formule"], ["no", ""], ["si", "rendimento e confronto"]] },
    { label: "Mutui e finanziamenti", cells: [["parziale", "se scrivi le formule"], ["no", ""], ["si", "piano, TAEG, estinzione"]] },
    { label: "Patrimonio netto nel tempo", cells: [["parziale", "aggiornato a mano"], ["no", ""], ["si", "ogni giorno"]] },
    { label: "Dati tuoi, esportabili", cells: [["si", "il file è tuo"], ["parziale", "dipende dall'app"], ["si", "ZIP completo, quando vuoi"]] },
  ] satisfies readonly CompareRow[],
} as const;
