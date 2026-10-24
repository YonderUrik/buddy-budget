/**
 * Who builds BuddyBudget and how much it has shipped: the home block «Ancora niente iscritti da contare», the `/about`
 * and `/changelog` pages. Pre-launch there are no users to count, no reviews and no press, so these texts only use
 * what anyone can check: the founder's name (already public as data controller in the Privacy), the public code and
 * the dated releases of `CHANGELOG.md` (`lib/changelog.ts`). Never a user count, a testimonial or a rating until
 * they exist for real.
 */
import type { ProjectActivity } from "@/lib/changelog";
import { longDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { LEGAL_OWNER, LEGAL_PATHS } from "./legal";
import { CONTENT_PATHS } from "./seo-pages";

/** Founder and public profile. Only links Daniele has chosen to show: no photo, no LinkedIn/X until he says so. */
export const FOUNDER = {
  name: LEGAL_OWNER.name,
  profile: "https://github.com/YonderUrik",
  handle: "YonderUrik",
} as const;

/** Day the repository was created on GitHub (its `created_at`): the code is public since then. */
export const CODE_PUBLIC_SINCE = "2026-07-03";

/** People other than the founder with commits on `main`, by their public GitHub handle. */
export const CONTRIBUTORS: readonly { handle: string; href: string }[] = [
  { handle: "Mario2414", href: "https://github.com/Mario2414" },
  { handle: "omblivion", href: "https://github.com/omblivion" },
];

export interface LinkText {
  label: string;
  href: string;
}

/** The home block that stands where a usage count would: the work, counted and dated. */
export interface ActivityText {
  title: string;
  text: string;
  figures: (a: ProjectActivity) => readonly { value: string; caption: string }[];
  source: string;
  changelog: LinkText;
  about: LinkText;
}

export interface AboutSection {
  title: string;
  /** Paragraphs; each may end with links. */
  paragraphs: readonly string[];
  links?: readonly LinkText[];
}

export interface AboutText {
  title: string;
  /** `<title>` of the page. */
  metaTitle: string;
  description: string;
  lead: string;
  sections: (a: ProjectActivity | null) => readonly AboutSection[];
  ctaTitle: string;
  ctaText: string;
}

export interface ChangelogText {
  title: string;
  metaTitle: string;
  description: string;
  lead: (a: ProjectActivity | null) => string;
  note: string;
  kinds: Record<"feat" | "fix" | "perf", string>;
  /** Accessible name of the PR link («modifica #492»). */
  pr: string;
  /** Shown when the build has no `CHANGELOG.md`. */
  missing: string;
  github: string;
  ctaTitle: string;
  ctaText: string;
}

export interface ProjectContent {
  locale: Locale;
  activity: ActivityText;
  about: AboutText;
  changelog: ChangelogText;
}

/** Repository links used by the pages; `source` is `SOURCE_URL` (empty in a build without the public repository). */
export function repoLinks(source: string) {
  return {
    decisions: `${source}/tree/main/docs/decisioni`,
    architecture: `${source}/tree/main/docs/architecture`,
    contributors: `${source}/graphs/contributors`,
    issues: `${source}/issues`,
    releases: `${source}/releases`,
    changelog: `${source}/blob/main/CHANGELOG.md`,
  };
}

export const PROJECT_IT: ProjectContent = {
  locale: "it",
  activity: {
    title: "Ancora niente iscritti da contare.",
    text: "Siamo all'inizio, quindi non ti mostriamo numeri di utenti. Ti mostriamo il lavoro: ogni versione è pubblica, con la data e cosa è cambiato.",
    figures: (a) => [
      { value: String(a.releases), caption: `versioni pubblicate dal ${longDate(a.firstDate, "it")}` },
      { value: String(a.featureReleases), caption: "con almeno una funzione nuova" },
      { value: longDate(a.latest.date, "it", true), caption: `l'ultima versione, la ${a.latest.version}` },
    ],
    source: "Contate dal CHANGELOG.md del codice a ogni versione.",
    changelog: { label: "Tutte le novità, con le date", href: CONTENT_PATHS.changelog },
    about: { label: "Chi c'è dietro", href: CONTENT_PATHS.about },
  },
  about: {
    title: "Chi c'è dietro",
    metaTitle: `Chi c'è dietro BuddyBudget: ${FOUNDER.name}, Torino`,
    description: `BuddyBudget lo costruisce ${FOUNDER.name}, a Torino: perché esiste, come è fatto, chi ha contribuito e come contattare Daniele.`,
    lead: `BuddyBudget lo costruisce ${FOUNDER.name}, a Torino, nel tempo libero. Non c'è un'azienda dietro: c'è una persona, con il suo nome.`,
    sections: (a) => [
      {
        title: "Perché esiste",
        paragraphs: [
          "Chi tiene d'occhio i propri soldi di solito usa tre strumenti: un'app per le spese, un foglio per gli investimenti, un altro per il mutuo. BuddyBudget li mette in un'app sola e in un numero solo.",
          "E applica le regole italiane dove cambiano il risultato: plusvalenze e minusvalenze, zainetto fiscale, titoli di Stato al 12,5%, imposta di bollo, tassazione del fondo pensione.",
        ],
      },
      {
        title: "Come è fatto",
        paragraphs: [
          "Lo scrive soprattutto una persona, con un assistente AI per il codice. Ogni numero viene da una funzione con i suoi test, e ogni scelta ha una nota pubblica con la data e il perché.",
        ],
        links: [
          { label: "Le decisioni, una per file", href: "decisions" },
          { label: "Come si calcola ogni numero", href: "architecture" },
        ],
      },
      {
        title: "Da quando",
        paragraphs: [
          a
            ? `Il codice è pubblico dal ${longDate(CODE_PUBLIC_SINCE, "it")}. La prima versione numerata è del ${longDate(a.firstDate, "it")}; da allora ne sono uscite ${a.releases}, l'ultima il ${longDate(a.latest.date, "it")}.`
            : `Il codice è pubblico dal ${longDate(CODE_PUBLIC_SINCE, "it")}.`,
        ],
        links: [{ label: "Tutte le novità, con le date", href: CONTENT_PATHS.changelog }],
      },
      {
        title: "Chi ha contribuito",
        paragraphs: [
          `Oltre a Daniele hanno scritto codice ${CONTRIBUTORS.map((c) => c.handle).join(" e ")}. Chiunque può segnalare un problema o proporre una modifica su GitHub.`,
        ],
        links: [
          { label: "Chi ha contribuito", href: "contributors" },
          { label: "Segnala un problema", href: "issues" },
        ],
      },
      {
        title: "Chi risponde dei tuoi dati",
        paragraphs: [
          `Il titolare del trattamento è ${FOUNDER.name}, persona fisica, che gestisce BuddyBudget a titolo gratuito durante la beta. Indirizzo e dettagli sono nell'informativa privacy.`,
        ],
        links: [{ label: "Privacy", href: LEGAL_PATHS.privacy }],
      },
    ],
    ctaTitle: "Il tuo numero, da domani mattina.",
    ctaText: "Vuoi guardare prima? La demo è l'account di Giulia, senza iscriverti.",
  },
  changelog: {
    title: "Novità, versione per versione",
    metaTitle: "Novità di BuddyBudget, versione per versione",
    description: "Ogni versione di BuddyBudget con la sua data e cosa è cambiato, presa dal codice a ogni rilascio.",
    lead: (a) =>
      a
        ? `Ogni versione dell'app con la sua data e cosa è cambiato, presa dal codice a ogni rilascio: ${a.releases} versioni dal ${longDate(a.firstDate, "it")}.`
        : "Ogni versione dell'app con la sua data e cosa è cambiato, presa dal codice a ogni rilascio.",
    note: "Le righe sono i titoli delle modifiche al codice: le più recenti sono in inglese, la lingua del codice. Gli aggiornamenti delle librerie non sono elencati.",
    kinds: { feat: "Novità", fix: "Correzione", perf: "Più veloce" },
    pr: "modifica",
    missing: "La storia delle versioni è su GitHub.",
    github: "Le versioni su GitHub",
    ctaTitle: "Il tuo numero, da domani mattina.",
    ctaText: "Vuoi guardare prima? La demo è l'account di Giulia, senza iscriverti.",
  },
};
