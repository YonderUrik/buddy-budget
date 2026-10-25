/**
 * Words of an answer row in «Cerca» («Serenis · 2026», «8 movimenti»), written in the user's language from the figures
 * the server computed. Pure: the palette and the tests use it. Amounts go through `formatCurrency`, so they hide with
 * the «nascondi importi» button like every other amount.
 */

import { formatCurrency, formatDateWithYear } from "@/lib/format";
import type { QuestionPeriod } from "@/lib/commands/question";
import type { SearchAnswer, SearchHit } from "./types";

export type AnswerTranslate = (key: string, values?: Record<string, string>) => string;

/** «2026» or «ottobre 2026». */
export function periodLabel(period: QuestionPeriod, locale: string): string {
  const [year, month] = period.from.split("-").map(Number);
  if (period.kind === "anno") return String(year);
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

const count = (n: number, none: string, one: string, many: string, tr: AnswerTranslate) => (n === 0 ? tr(none) : n === 1 ? tr(one) : tr(many, { 0: String(n) }));

/** First line: what the figure is about. `hit.title` holds only the name (merchant, category, account, security, loan). */
export function answerTitle(hit: SearchHit & { answer: SearchAnswer }, locale: string, tr: AnswerTranslate): string {
  const { answer } = hit;
  switch (answer.kind) {
    case "totale":
      return `${hit.title || tr(answer.direction === "uscite" ? "Uscite" : "Entrate")} · ${periodLabel(answer.period, locale)}`;
    case "saldo":
      return hit.title || tr("Saldo dei conti");
    case "patrimonio":
      return answer.date ? tr("Patrimonio netto al {0}", { 0: formatDateWithYear(answer.date, locale) }) : tr("Patrimonio netto");
    case "portafoglio":
      return hit.title || tr("Portafoglio");
    case "rata":
      return answer.date === null ? tr("Nessuna rata in arrivo") : hit.title || tr("Prossima rata");
  }
}

/** Second line: how the figure was made, or why there is none. */
export function answerLine(hit: SearchHit & { answer: SearchAnswer }, locale: string, currency: string, tr: AnswerTranslate): string {
  const { answer } = hit;
  switch (answer.kind) {
    case "totale": {
      const parts = [count(answer.count, "Nessun movimento", "1 movimento", "{0} movimenti", tr)];
      if (answer.category) parts.unshift(tr("Categoria"));
      if (answer.partial) parts.push(tr("solo gli ultimi 24 mesi"));
      return parts.join(" · ");
    }
    case "saldo":
      return hit.title ? tr("Saldo del conto") : count(answer.accounts, "Nessun conto", "1 conto", "{0} conti", tr);
    case "patrimonio":
      if (answer.missing) return tr(answer.date ? "Lo storico non arriva a quel giorno" : "Aggiungi un conto per vederlo");
      return tr(answer.date ? "Dallo storico, al netto dei debiti" : "Al netto dei debiti");
    case "portafoglio": {
      if (answer.positions === 0) return tr("Nessun titolo in portafoglio");
      const parts = [hit.title ? tr("Valore di oggi") : count(answer.positions, "Nessun titolo", "1 titolo", "{0} titoli", tr)];
      if (answer.gain !== null) parts.push(tr(answer.gain >= 0 ? "guadagno {0}" : "perdita {0}", { 0: formatCurrency(Math.abs(answer.gain), currency, { locale }) }));
      return parts.join(" · ");
    }
    case "rata":
      if (answer.date === null) return tr("Nessun finanziamento con rate da pagare");
      return tr(answer.overdue ? "Rata scaduta il {0}" : "Prossima rata il {0}", { 0: formatDateWithYear(answer.date, locale) });
  }
}

/** Whether an answer has a figure worth showing on its own; without one «Chiedi all'AI» stays offered. */
export function isUsefulAnswer(answer: SearchAnswer): boolean {
  switch (answer.kind) {
    case "totale":
      return answer.count > 0;
    case "saldo":
      return answer.accounts > 0;
    case "patrimonio":
      return !answer.missing;
    case "portafoglio":
      return answer.positions > 0;
    case "rata":
      return answer.date !== null;
  }
}
