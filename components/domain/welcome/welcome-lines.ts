/** Texts and links of each line of the «Dall'ultima visita» summary: pure, so the wording is tested once for every item. */

import type { WelcomeHappened, WelcomeItemKind, WelcomeWaiting } from "@/lib/welcome";

type Translate = (source: string, values?: Record<string, string | number>) => string;

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

/**
 * The «Dall'ultima visita» label beside the Panoramica date: the first thing that happened, followed by «e altro» when
 * the opened summary has more lines («12 movimenti nuovi e altro»). Nothing happened, no label: what waits alone is
 * not news, Liquidità and Categorizza already show it.
 */
export function welcomeLabel(happened: readonly WelcomeLine[], waiting: readonly WelcomeLine[], tr: Translate): string | null {
  const head = happened[0];
  if (!head) return null;
  // The count never ends a line apart from its words.
  const label = `${head.figure}\u00a0${head.title}`;
  return happened.length + waiting.length > 1 ? `${label} ${tr("e altro")}` : label;
}
