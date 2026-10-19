/** Texts and links of each line of the «Dall'ultima visita» summary: pure, so the wording is tested once for every item. */

import type { WelcomeHappened, WelcomeItemKind, WelcomeWaiting } from "@/lib/welcome";

type Translate = (source: string, values?: Record<string, string | number>) => string;

/** Formatters the lines need (from `localizedFormats`, so «Nascondi importi» masks the amounts). */
export interface WelcomeFormatters {
  money: (value: number) => string;
  price: (value: number, currency: string) => string;
}

export interface WelcomeLine {
  kind: WelcomeItemKind;
  /** The count shown big on the left. */
  figure: number;
  title: string;
  detail: string;
  href: string;
  /** Pill button label: only lines that wait for the user have one. */
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
export function happenedLine(item: WelcomeHappened, tr: Translate, fmt: WelcomeFormatters): WelcomeLine {
  switch (item.kind) {
    case "movements": {
      const parts = [
        item.income > 0 ? tr("entrate {0}", { 0: fmt.money(item.income) }) : null,
        item.expenses > 0 ? tr("uscite {0}", { 0: fmt.money(item.expenses) }) : null,
      ].filter((part): part is string => part !== null);
      return {
        kind: item.kind,
        figure: item.count,
        title: item.count === 1 ? tr("movimento nuovo") : tr("movimenti nuovi"),
        detail: parts.length > 0 ? parts.join(" · ") : tr("Esclusi da entrate e uscite"),
        href: WELCOME_HREFS.movements,
      };
    }
    case "price_alerts": {
      const { name, direction, price, currency } = item.first;
      const level = fmt.price(price, currency);
      const what = direction === "sopra" ? tr("{0} è salito sopra {1}", { 0: name, 1: level }) : tr("{0} è sceso sotto {1}", { 0: name, 1: level });
      return {
        kind: item.kind,
        figure: item.count,
        title: item.count === 1 ? tr("avviso di prezzo scattato") : tr("avvisi di prezzo scattati"),
        detail: item.count === 1 ? what : tr("L'ultimo: {0}", { 0: what }),
        href: WELCOME_HREFS.price_alerts,
      };
    }
    case "price_rises": {
      const { name, from, to } = item.first;
      const what = tr("{0} da {1} a {2}", { 0: name, 1: fmt.money(from), 2: fmt.money(to) });
      return {
        kind: item.kind,
        figure: item.count,
        title: item.count === 1 ? tr("abbonamento costa di più") : tr("abbonamenti costano di più"),
        detail: item.count === 1 ? what : tr("L'ultimo: {0}", { 0: what }),
        href: WELCOME_HREFS.price_rises,
      };
    }
  }
}

/** One line for something that waits for the user, with its action. */
export function waitingLine(item: WelcomeWaiting, tr: Translate): WelcomeLine {
  switch (item.kind) {
    case "to_decide":
      return {
        kind: item.kind,
        figure: item.count,
        title: item.count === 1 ? tr("movimento senza categoria") : tr("movimenti senza categoria"),
        detail: tr("Scegli dove vanno: poi l'app li riconosce da sola"),
        href: WELCOME_HREFS.to_decide,
        action: tr("Decidi"),
      };
    case "subscriptions":
      return {
        kind: item.kind,
        figure: item.count,
        title: item.count === 1 ? tr("abbonamento da confermare") : tr("abbonamenti da confermare"),
        detail: tr("Addebiti che tornano ogni mese o ogni anno"),
        href: WELCOME_HREFS.subscriptions,
        action: tr("Controlla"),
      };
    case "import_review":
      return {
        kind: item.kind,
        figure: item.count,
        title: tr("import da controllare"),
        detail: tr("Alcune righe del file non sono state riconosciute"),
        href: `${WELCOME_HREFS.import_review}?job=${item.jobId}`,
        action: tr("Apri"),
      };
  }
}

/** What the «Dall'ultima visita» toast says: one line per group and the most useful action. */
export interface WelcomeToastContent {
  title: string;
  description: string;
  action: { label: string; href: string; kind: WelcomeItemKind };
}

/**
 * Packs the summary into one toast: what happened as the title («Mentre eri via: 12 movimenti nuovi · …»), what waits
 * as the description («Da sistemare: 7 movimenti senza categoria»), and the action of the first thing that waits (or
 * a way to see the first thing that happened). With one group only, the description is that group's first detail.
 */
export function welcomeToastContent(happened: readonly WelcomeLine[], waiting: readonly WelcomeLine[], tr: Translate): WelcomeToastContent | null {
  // The count never ends a line apart from its words.
  const label = (lines: readonly WelcomeLine[]) => lines.map((line) => `${line.figure}\u00a0${line.title}`).join(" · ");
  const first = waiting[0] ?? happened[0];
  if (!first) return null;
  const title = happened.length > 0 ? tr("Mentre eri via: {0}", { 0: label(happened) }) : tr("Da sistemare: {0}", { 0: label(waiting) });
  const description =
    happened.length > 0 && waiting.length > 0 ? tr("Da sistemare: {0}", { 0: label(waiting) }) : first.detail;
  return { title, description, action: { label: first.action ?? tr("Vedi"), href: first.href, kind: first.kind } };
}
