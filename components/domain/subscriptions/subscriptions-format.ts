/** Testi italiani degli abbonamenti: cadenza, quando arriva l'addebito, motivi del rilevamento. Funzioni pure. */

import { CADENCE_LABELS, type SubscriptionReason } from "@/lib/calc/subscriptions";
import { localizedFormats } from "@/lib/localization/format";
import type { SubscriptionItem } from "@/lib/subscriptions/view";
import { translate, type MessageValues } from "@/lib/localization/messages";
import { LANGUAGE_LOCALES, type Language } from "@/lib/localization/config";

/** Bind presentation text and formatting to one language without shared mutable state. */
export function localizedSubscriptionFormats(language: Language) {
  const locale = LANGUAGE_LOCALES[language];
  const { formatCurrency, formatDateWithYear, formatShortDate } = localizedFormats(locale);
  const tr = (source: string, values?: MessageValues) => translate(language, source, values);
const DAY_MS = 86_400_000;
/** Oltre questi giorni di distanza la data si scrive con l'anno (un annuale appena addebitato). */
const YEAR_AWAY_DAYS = 300;
const dayNumber = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY_MS;

/** Giorni da `today` a `date` (negativi se passata). */
function daysBetween(today: string, date: string): number {
  return Math.round(dayNumber(date) - dayNumber(today));
}

/** «oggi», «domani», «tra 5 giorni» o la data breve: come si dice un prossimo addebito. */
function whenPhrase(today: string, date: string): string {
  const days = daysBetween(today, date);
  if (days === 0) return tr("oggi");
  if (days === 1) return tr("domani");
  if (days > 1 && days <= 14) return tr("tra {0} giorni", { 0: days });
  return onDate(date, days > YEAR_AWAY_DAYS);
}

/** «dal 12 nov» / «dall'8 nov» (stessa elisione di `onDate`). */
function fromDate(date: string, withYear = false): string {
  const day = +date.slice(8, 10);
  const formatted = withYear ? formatDateWithYear(date) : formatShortDate(date);
  return language === "it" ? `${day === 8 || day === 11 ? "dall'" : "dal "}${formatted}` : tr("dal {0}", {0: formatted});
}

/** «il 12 nov» / «l'8 nov» (l'articolo davanti a 8 e 11 si elide). */
function onDate(date: string, withYear = false): string {
  const day = +date.slice(8, 10);
  const formatted = withYear ? formatDateWithYear(date) : formatShortDate(date);
  return language === "it" ? `${day === 8 || day === 11 ? "l'" : "il "}${formatted}` : tr("il {0}", {0: formatted});
}

/** Riga di sintesi di un abbonamento: «ogni mese · prossimo addebito tra 5 giorni». */
function itemHint(item: SubscriptionItem, today: string): string {
  const cadence = item.cadence ? tr(CADENCE_LABELS[item.cadence]) : tr("cadenza da definire");
  if (item.decision === "terminato" || item.decision === "escluso") return item.lastDate ? tr("{0} · ultimo addebito {1}", { 0: cadence, 1: onDate(item.lastDate) }) : cadence;
  if (item.activity === "fermo") return item.lastDate ? tr("Ultimo addebito {0}, atteso {1}", { 0: onDate(item.lastDate), 1: onDate(item.nextDate ?? item.lastDate) }) : tr("{0} · non lo vediamo più tra i movimenti", { 0: cadence });
  if (!item.nextDate) return cadence;
  const overdue = daysBetween(today, item.nextDate) < 0;
  return `${cadence} · ${overdue ? tr("atteso") : tr("prossimo")} ${whenPhrase(today, item.nextDate)}`;
}

/** Frase per un motivo del rilevamento («6 addebiti», «ogni mese, sempre intorno al giorno 8»…). */
function reasonSentence(reason: SubscriptionReason, currency: string): string {
  switch (reason.kind) {
    case "count":
      return tr("{0} addebiti dello stesso esercente", { 0: reason.count });
    case "cadence":
      return tr("Tornano {0}{1}", { 0: tr(CADENCE_LABELS[reason.cadence]), 1: reason.skipped ? tr(" (un addebito è saltato, lo abbiamo perdonato)") : "" });
    case "amount":
      return reason.mode === "costante" ? tr("Importo sempre uguale") : tr("Importo quasi sempre uguale (differenze minime)");
    case "price-change":
      return tr("Il prezzo è passato da {0} a {1} {2}", { 0: formatCurrency(reason.from, currency), 1: formatCurrency(reason.to, currency), 2: fromDate(reason.since, true) });
    case "day":
      return tr("Sempre intorno al giorno {0} del mese", { 0: reason.day });
  }
}

/** Iniziale del nome per l'avatar. */
function initialOf(name: string): string {
  return (name.trim().charAt(0) || "?").toLocaleUpperCase(locale);
}
  return { daysBetween, whenPhrase, fromDate, onDate, itemHint, reasonSentence, initialOf };
}

/** Italian defaults retained for existing callers and pure calculation tests. */
export const { daysBetween, whenPhrase, fromDate, onDate, itemHint, reasonSentence, initialOf } = localizedSubscriptionFormats("it");
