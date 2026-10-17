import { formatShortDate } from "@/lib/format";
import type { PushMessage } from "@/lib/push/types";
import type { BudgetAlert, DeadlineAlert } from "./alerts";
import type { DigestPeriod } from "./digest";
import type { GoalNotice } from "./goals";

/**
 * Text of the push notifications, one per email kind. Never amounts: a notification shows on the lock screen, where
 * anyone can read it; names (category, loan, goal) and dates are enough to know what to open. Italian like the emails.
 */

export function budgetAlertPush(alerts: BudgetAlert[]): PushMessage {
  const [first] = alerts;
  const body =
    alerts.length === 1
      ? first.threshold >= 100
        ? `${first.name}: hai superato il budget del mese.`
        : `${first.name}: hai usato l'${first.threshold}% del budget del mese.`
      : `${alerts.length} categorie sono vicine o oltre il budget del mese.`;
  return { title: "Budget del mese", body, path: "/liquidita/analisi" };
}

export function deadlineAlertPush(alerts: DeadlineAlert[]): PushMessage {
  const [first] = alerts;
  const overdue = alerts.some((a) => a.overdue);
  const body =
    alerts.length === 1
      ? first.overdue
        ? `${first.name}: la rata del ${formatShortDate(first.date)} risulta scaduta.`
        : `${first.name}: la rata scade il ${formatShortDate(first.date)}.`
      : `${alerts.length} rate in scadenza${overdue ? " o scadute" : ""}.`;
  return { title: overdue ? "Rata scaduta" : "Rata in arrivo", body, path: "/debiti/finanziamenti" };
}

export function goalsPush(notice: GoalNotice): PushMessage {
  const reached = notice.alerts.filter((a) => a.type === "raggiunto");
  const due = notice.alerts.filter((a) => a.type === "scadenza");
  const path = "/analitiche/obiettivi?da=notifica";
  if (reached.length === 1) return { title: "Obiettivo raggiunto", body: `Hai messo da parte tutto per «${reached[0].goal.name}».`, path };
  if (reached.length > 1) return { title: "Obiettivi raggiunti", body: `Hai raggiunto ${reached.length} obiettivi di risparmio.`, path };
  if (due.length === 1) return { title: "Obiettivo in scadenza", body: `«${due[0].goal.name}» si avvicina alla data che hai scelto.`, path };
  if (due.length > 1) return { title: "Obiettivi in scadenza", body: `${due.length} obiettivi si avvicinano alla data che hai scelto.`, path };
  return { title: "I tuoi obiettivi", body: "A che punto sei con gli obiettivi di risparmio questo mese.", path };
}

export function digestPush(period: DigestPeriod): PushMessage {
  const subject = period.period === "mese" ? `di ${period.label.toLowerCase()}` : `della settimana ${period.label}`;
  return { title: "Il tuo riepilogo", body: `Entrate, uscite e investimenti ${subject}: aprilo per vederli.`, path: "/" };
}
