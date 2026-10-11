/** Testi italiani degli abbonamenti: cadenza, quando arriva l'addebito, motivi del rilevamento. Funzioni pure. */

import { CADENCE_LABELS, type SubscriptionReason } from "@/lib/calc/subscriptions";
import { formatCurrency, formatDateWithYear, formatShortDate } from "@/lib/format";
import type { SubscriptionItem } from "@/lib/subscriptions/view";

const DAY_MS = 86_400_000;
/** Oltre questi giorni di distanza la data si scrive con l'anno (un annuale appena addebitato). */
const YEAR_AWAY_DAYS = 300;
const dayNumber = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY_MS;

/** Giorni da `today` a `date` (negativi se passata). */
export function daysBetween(today: string, date: string): number {
  return Math.round(dayNumber(date) - dayNumber(today));
}

/** «oggi», «domani», «tra 5 giorni» o la data breve: come si dice un prossimo addebito. */
export function whenPhrase(today: string, date: string): string {
  const days = daysBetween(today, date);
  if (days === 0) return "oggi";
  if (days === 1) return "domani";
  if (days > 1 && days <= 14) return `tra ${days} giorni`;
  return onDate(date, days > YEAR_AWAY_DAYS);
}

/** «dal 12 nov» / «dall'8 nov» (stessa elisione di `onDate`). */
export function fromDate(date: string, withYear = false): string {
  const day = +date.slice(8, 10);
  return `${day === 8 || day === 11 ? "dall'" : "dal "}${withYear ? formatDateWithYear(date) : formatShortDate(date)}`;
}

/** «il 12 nov» / «l'8 nov» (l'articolo davanti a 8 e 11 si elide). */
export function onDate(date: string, withYear = false): string {
  const day = +date.slice(8, 10);
  return `${day === 8 || day === 11 ? "l'" : "il "}${withYear ? formatDateWithYear(date) : formatShortDate(date)}`;
}

/** Riga di sintesi di un abbonamento: «ogni mese · prossimo addebito tra 5 giorni». */
export function itemHint(item: SubscriptionItem, today: string): string {
  const cadence = item.cadence ? CADENCE_LABELS[item.cadence] : "cadenza da definire";
  if (item.decision === "terminato" || item.decision === "escluso") return item.lastDate ? `${cadence} · ultimo addebito ${onDate(item.lastDate)}` : cadence;
  if (item.activity === "fermo") return item.lastDate ? `Ultimo addebito ${onDate(item.lastDate)}, atteso ${onDate(item.nextDate ?? item.lastDate)}` : `${cadence} · non lo vediamo più tra i movimenti`;
  if (!item.nextDate) return cadence;
  const overdue = daysBetween(today, item.nextDate) < 0;
  return `${cadence} · ${overdue ? "atteso" : "prossimo"} ${whenPhrase(today, item.nextDate)}`;
}

/** Frase per un motivo del rilevamento («6 addebiti», «ogni mese, sempre intorno al giorno 8»…). */
export function reasonSentence(reason: SubscriptionReason, currency: string): string {
  switch (reason.kind) {
    case "count":
      return `${reason.count} addebiti dello stesso esercente`;
    case "cadence":
      return `Tornano ${CADENCE_LABELS[reason.cadence]}${reason.skipped ? " (un addebito è saltato, lo abbiamo perdonato)" : ""}`;
    case "amount":
      return reason.mode === "costante" ? "Importo sempre uguale" : "Importo quasi sempre uguale (differenze minime)";
    case "price-change":
      return `Il prezzo è passato da ${formatCurrency(reason.from, currency)} a ${formatCurrency(reason.to, currency)} ${fromDate(reason.since, true)}`;
    case "day":
      return `Sempre intorno al giorno ${reason.day} del mese`;
  }
}

/** Iniziale del nome per l'avatar. */
export function initialOf(name: string): string {
  return (name.trim().charAt(0) || "?").toLocaleUpperCase("it-IT");
}
