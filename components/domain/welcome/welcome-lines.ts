/** Texts and links of each line of the «Dall'ultima visita» summary: pure, so the wording is tested once for every item. */

import type { WelcomeHappened, WelcomeItemKind, WelcomeWaiting } from "@/lib/welcome";

type Translate = (source: string, values?: Record<string, string | number>) => string;
/** Joins labels the way the language does («a, b e c»): `Intl.ListFormat` in the user's locale. */
type JoinList = (items: string[]) => string;

export interface WelcomeLine {
  kind: WelcomeItemKind;
  /** How many: written before the words, never apart from them. */
  figure: number;
  title: string;
  href: string;
  /** Button label: only lines that wait for the user have one. */
  action?: string;
}

/** Where each line leads. */
export const WELCOME_HREFS = {
  movements: "/liquidita",
  price_alerts: "/investimenti/titoli",
  price_rises: "/liquidita/abbonamenti",
  to_decide: "/categorizza",
  subscriptions: "/liquidita/abbonamenti",
  import_review: "/importazioni",
} as const satisfies Record<WelcomeItemKind, string>;

/** One line for something that happened while the user was away. */
export function happenedLine(item: WelcomeHappened, tr: Translate): WelcomeLine {
  const one = item.count === 1;
  const title = {
    movements: one ? tr("movimento nuovo") : tr("movimenti nuovi"),
    price_alerts: one ? tr("avviso di prezzo scattato") : tr("avvisi di prezzo scattati"),
    price_rises: one ? tr("abbonamento costa di più") : tr("abbonamenti costano di più"),
  }[item.kind];
  return { kind: item.kind, figure: item.count, title, href: WELCOME_HREFS[item.kind] };
}

/** One line for something that waits for the user, with its action. */
export function waitingLine(item: WelcomeWaiting, tr: Translate): WelcomeLine {
  const one = item.count === 1;
  switch (item.kind) {
    case "to_decide":
      return {
        kind: item.kind,
        figure: item.count,
        title: one ? tr("movimento senza categoria") : tr("movimenti senza categoria"),
        href: WELCOME_HREFS.to_decide,
        action: tr("Decidi"),
      };
    case "subscriptions":
      return {
        kind: item.kind,
        figure: item.count,
        title: one ? tr("abbonamento da confermare") : tr("abbonamenti da confermare"),
        href: WELCOME_HREFS.subscriptions,
        action: tr("Controlla"),
      };
    case "import_review":
      return {
        kind: item.kind,
        figure: item.count,
        title: tr("import da controllare"),
        href: `${WELCOME_HREFS.import_review}?job=${item.jobId}`,
        action: tr("Apri"),
      };
  }
}

/** What the «Dall'ultima visita» toast says: up to two lines (what happened, what waits) and the most useful action. */
export interface WelcomeToastContent {
  lines: string[];
  action: { label: string; href: string; kind: WelcomeItemKind };
}

/**
 * Packs the summary into the toast title, one line per group («Mentre eri via: 12 movimenti nuovi e 1 avviso di prezzo
 * scattato», «Da sistemare: 7 movimenti senza categoria»), with the action of the first thing that waits (or «Vedi» on
 * the first thing that happened). No description: the title says it all.
 */
export function welcomeToastContent(
  happened: readonly WelcomeLine[],
  waiting: readonly WelcomeLine[],
  tr: Translate,
  join: JoinList,
): WelcomeToastContent | null {
  // The count never ends a line apart from its words.
  const label = (lines: readonly WelcomeLine[]) => join(lines.map((line) => `${line.figure}\u00a0${line.title}`));
  const first = waiting[0] ?? happened[0];
  if (!first) return null;
  const lines = [
    happened.length > 0 ? tr("Mentre eri via: {0}", { 0: label(happened) }) : null,
    waiting.length > 0 ? tr("Da sistemare: {0}", { 0: label(waiting) }) : null,
  ].filter((part): part is string => part !== null);
  return { lines, action: { label: first.action ?? tr("Vedi"), href: first.href, kind: first.kind } };
}
