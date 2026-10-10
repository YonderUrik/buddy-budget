import { renderEmail, type EmailFooter } from "@/lib/email";
import { formatLongDate } from "@/lib/format";
import { NOTIFICATION_KIND_INFO, type NotificationKind } from "./constants";
import type { BudgetAlert, DeadlineAlert } from "./alerts";
import type { DigestData } from "./digest";

/** Formatta un importo (già nascosto, se l'utente ha scelto «nascondi importi»). */
export type MoneyFormatter = (value: number) => string;

export interface EmailContext {
  appUrl: string;
  money: MoneyFormatter;
  /** Indirizzi del piè di pagina: link di disiscrizione dedicato al tipo di email e pagina delle preferenze. */
  unsubscribeUrl: string;
  preferencesUrl: string;
}

export interface BuiltEmail {
  subject: string;
  text: string;
  html: string;
}

/** Percorso delle preferenze in Impostazioni (sezione Notifiche). */
export const NOTIFICATION_SETTINGS_PATH = "/impostazioni#impostazioni-notifiche";

function footerFor(kind: NotificationKind, ctx: EmailContext): EmailFooter {
  return { kind: "optional", reason: NOTIFICATION_KIND_INFO[kind].reason, unsubscribeUrl: ctx.unsubscribeUrl, preferencesUrl: ctx.preferencesUrl };
}

function percentChange(current: number, previous: number): number | null {
  return previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
}

/** Email del riepilogo periodico: solo cifre già calcolate dall'app, nessun consiglio. Pura, per poterla testare. */
export function digestEmail(data: DigestData, ctx: EmailContext): BuiltEmail {
  const { period, spent, income, previousSpent, topCategories, budget } = data;
  const opening = period.period === "mese" ? `A ${period.label.toLowerCase()}` : `Nella settimana ${period.label}`;
  const net = income - spent;
  const change = percentChange(spent, previousSpent);
  const sentences = [
    `${opening} hai speso **${ctx.money(spent)}** e incassato **${ctx.money(income)}**.`,
    net >= 0 ? `Ti sono rimasti **${ctx.money(net)}**.` : `Hai speso **${ctx.money(-net)}** più di quanto hai incassato.`,
    change === null
      ? null
      : Math.abs(change) < 1
        ? "Le spese sono in linea con il periodo precedente."
        : `Le spese sono ${Math.abs(change)}% ${change > 0 ? "più alte" : "più basse"} del periodo precedente.`,
    budget === null ? null : budget.over === 0 ? "Sei dentro il budget in tutte le categorie." : `Hai superato il budget in **${budget.over}** ${budget.over === 1 ? "categoria" : "categorie"} su ${budget.total}.`,
  ].filter((s): s is string => s !== null);
  const rendered = renderEmail(
    {
      title: period.period === "mese" ? "Riepilogo del mese" : "Riepilogo della settimana",
      lead: sentences.join(" "),
      preheader: "Le cifre del periodo appena concluso.",
      details: topCategories.map((c) => ({ label: c.name, value: ctx.money(c.amount) })),
      cta: { label: "Apri la Panoramica", url: `${ctx.appUrl}/panoramica` },
      footer: footerFor("digest", ctx),
    },
    { appUrl: ctx.appUrl },
  );
  return { subject: period.period === "mese" ? "Il riepilogo del tuo mese" : "Il riepilogo della tua settimana", ...rendered };
}

/** Email degli avvisi sul budget del mese: una sola email per più categorie. Pura. */
export function budgetAlertEmail(alerts: BudgetAlert[], ctx: EmailContext): BuiltEmail {
  const exceeded = alerts.filter((a) => a.threshold >= 100).length;
  const lead =
    alerts.length === 1
      ? `Questo mese hai usato **${Math.round((alerts[0].spent / alerts[0].budget) * 100)}%** del budget di **${alerts[0].name}**: **${ctx.money(alerts[0].spent)}** su **${ctx.money(alerts[0].budget)}**.`
      : `Questo mese ${alerts.length} categorie sono vicine al budget o lo hanno superato${exceeded > 0 ? ` (${exceeded} già sopra)` : ""}.`;
  const rendered = renderEmail(
    {
      title: "Avviso sul budget",
      lead,
      preheader: "Una o più categorie hanno raggiunto il budget del mese.",
      details: alerts.length === 1 ? [] : alerts.map((a) => ({ label: a.name, value: `${Math.round((a.spent / a.budget) * 100)}% · ${ctx.money(a.spent)} su ${ctx.money(a.budget)}` })),
      cta: { label: "Guarda i budget", url: `${ctx.appUrl}/liquidita` },
      footer: footerFor("budget", ctx),
    },
    { appUrl: ctx.appUrl },
  );
  return { subject: exceeded > 0 ? "Hai superato un budget questo mese" : "Sei vicino al limite di un budget", ...rendered };
}

/** Email degli avvisi sulle rate in scadenza o scadute. Pura. */
export function deadlineAlertEmail(alerts: DeadlineAlert[], ctx: EmailContext): BuiltEmail {
  const when = (a: DeadlineAlert) => formatLongDate(new Date(`${a.date}T12:00:00Z`));
  const overdue = alerts.some((a) => a.overdue);
  const lead =
    alerts.length === 1
      ? `${alerts[0].overdue ? "La rata di" : "Sta per scadere la rata di"} **${alerts[0].name}**: **${ctx.money(alerts[0].amount)}**, ${alerts[0].overdue ? "scaduta il" : "il"} **${when(alerts[0])}**.`
      : `Hai ${alerts.length} rate in scadenza o scadute: la prima è quella di **${alerts[0].name}**, **${ctx.money(alerts[0].amount)}** il **${when(alerts[0])}**.`;
  const rendered = renderEmail(
    {
      title: "Rate in scadenza",
      lead,
      preheader: "Una rata dei tuoi finanziamenti è in scadenza.",
      details: alerts.length === 1 ? [] : alerts.map((a) => ({ label: `${a.name} · ${when(a)}`, value: ctx.money(a.amount) })),
      footnote: "Le rate si segnano a mano nell'app: dopo il pagamento non compaiono più tra le prossime scadenze.",
      cta: { label: "Apri i finanziamenti", url: `${ctx.appUrl}/debiti/finanziamenti` },
      footer: footerFor("deadlines", ctx),
    },
    { appUrl: ctx.appUrl },
  );
  return { subject: overdue ? "Hai una rata scaduta" : "Una rata sta per scadere", ...rendered };
}
