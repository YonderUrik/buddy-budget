import { renderEmail, type EmailFooter, type EmailSection } from "@/lib/email";
import { formatLongDate } from "@/lib/format";
import { NOTIFICATION_KIND_INFO, type NotificationKind } from "./constants";
import type { BudgetAlert, DeadlineAlert } from "./alerts";
import type { DigestData } from "./digest";
import type { InvestmentDigest } from "./investments-digest";

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
export const NOTIFICATION_SETTINGS_PATH = "/impostazioni?sezione=notifiche#impostazioni-notifiche";

function footerFor(kind: NotificationKind, ctx: EmailContext): EmailFooter {
  return { kind: "optional", reason: NOTIFICATION_KIND_INFO[kind].reason, unsubscribeUrl: ctx.unsubscribeUrl, preferencesUrl: ctx.preferencesUrl };
}

function percentChange(current: number, previous: number): number | null {
  return previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
}

const PERCENT = new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" });

/** Importo con il segno davanti (`+120 €`); con «nascondi importi» resta la sola maschera, senza svelare il segno. */
function signedMoney(value: number, money: MoneyFormatter): string {
  const formatted = money(value);
  return value > 0 && !formatted.includes("•") ? `+${formatted}` : formatted;
}

/** Righe «Liquidità» del riepilogo: entrate, uscite, quanto è rimasto, il confronto e la voce più pesante. */
function liquidityRows(data: DigestData, money: MoneyFormatter): EmailSection["rows"] {
  const { spent, income, previousSpent, topCategories, budget } = data;
  const change = percentChange(spent, previousSpent);
  const top = topCategories[0];
  return [
    { label: "Entrate", value: money(income) },
    { label: "Uscite", value: money(spent) },
    { label: income - spent >= 0 ? "Messi da parte" : "Speso più delle entrate", value: money(Math.abs(income - spent)) },
    ...(change === null ? [] : [{ label: data.period.period === "mese" ? "Uscite rispetto al mese prima" : "Uscite rispetto alla settimana prima", value: Math.abs(change) < 1 ? "in linea" : `${change > 0 ? "+" : ""}${change}%` }]),
    ...(top ? [{ label: "Voce più pesante", value: `${top.name} · ${money(top.amount)}` }] : []),
    ...(budget === null ? [] : [{ label: "Budget superati", value: `${budget.over} su ${budget.total}` }]),
  ];
}

/** Righe «Investimenti» del riepilogo: valore, guadagno del periodo, proventi e versamenti (questi ultimi solo se ci sono). */
function investmentRows(investments: InvestmentDigest, money: MoneyFormatter): EmailSection["rows"] {
  const { endValue, gain, twr, income, netContributions } = investments;
  return [
    { label: "Valore a fine periodo", value: money(endValue) },
    { label: "Guadagno del periodo", value: `${signedMoney(gain, money)}${twr === null ? "" : ` (${PERCENT.format(twr)})`}` },
    ...(income > 0 ? [{ label: "Dividendi e cedole", value: money(income) }] : []),
    ...(Math.abs(netContributions) >= 0.5 ? [{ label: netContributions > 0 ? "Investiti nel periodo" : "Ritirati nel periodo", value: money(Math.abs(netContributions)) }] : []),
  ];
}

/**
 * Email del riepilogo periodico: una frase con l'essenziale e due gruppi brevi, Liquidità e Investimenti, con le cifre
 * che l'app già calcola. Nessun consiglio e nessun giudizio sui numeri. Pura, per poterla testare.
 */
export function digestEmail(data: DigestData, ctx: EmailContext): BuiltEmail {
  const { period, spent, income, movements, investments, toDecide = 0 } = data;
  const monthly = period.period === "mese";
  const opening = monthly ? `A ${period.label.toLowerCase().replace(/ \d{4}$/, "")}` : `Nella settimana ${period.label}`;
  const sentences = [
    movements > 0 ? `${opening} hai speso **${ctx.money(spent)}** e incassato **${ctx.money(income)}**.` : `${opening} non hai movimenti sui conti.`,
    investments === null
      ? null
      : `I tuoi investimenti ${investments.gain >= 0 ? "hanno guadagnato" : "hanno perso"} **${ctx.money(Math.abs(investments.gain))}**${investments.income > 0 ? `, di cui **${ctx.money(investments.income)}** di dividendi e cedole` : ""}.`,
    toDecide > 0 ? `${toDecide === 1 ? "**Un movimento** aspetta" : `**${toDecide} movimenti** aspettano`} una categoria in Categorizza.` : null,
  ].filter((s): s is string => s !== null);
  const sections: EmailSection[] = [
    ...(movements > 0 ? [{ title: "Liquidità", rows: liquidityRows(data, ctx.money) }] : []),
    ...(investments ? [{ title: "Investimenti", rows: investmentRows(investments, ctx.money) }] : []),
  ];
  const rendered = renderEmail(
    {
      title: monthly ? `Riepilogo di ${period.label.toLowerCase()}` : `Riepilogo della settimana ${period.label}`,
      lead: sentences.join(" "),
      preheader: monthly ? "Il tuo mese in poche righe: conti e investimenti." : "La tua settimana in poche righe: conti e investimenti.",
      sections,
      footnote: investments ? "Il guadagno degli investimenti è al netto di quanto hai comprato o venduto nel periodo, con i prezzi di chiusura." : undefined,
      cta: { label: "Apri la Panoramica", url: `${ctx.appUrl}/panoramica` },
      footer: footerFor("digest", ctx),
    },
    { appUrl: ctx.appUrl },
  );
  return { subject: monthly ? "Il riepilogo del tuo mese" : "Il riepilogo della tua settimana", ...rendered };
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

/**
 * Email di annuncio di una novità, da mandare una volta a tutti gli utenti solo dopo l'approvazione del titolare.
 * Pura: lo screenshot e i passi arrivano dal chiamante. Il piè di pagina porta sempre il link per non ricevere altre novità.
 */
export function featureAnnouncementEmail(
  input: { title: string; lead: string; steps: string[]; imageUrl: string; imageAlt: string; ctaLabel: string; ctaPath: string; subject: string },
  ctx: EmailContext,
): BuiltEmail {
  const rendered = renderEmail(
    {
      title: input.title,
      lead: input.lead,
      image: { src: input.imageUrl, alt: input.imageAlt },
      steps: input.steps,
      cta: { label: input.ctaLabel, url: `${ctx.appUrl}${input.ctaPath}` },
      footer: { kind: "optional", reason: "l'account BuddyBudget", unsubscribeUrl: ctx.unsubscribeUrl, preferencesUrl: ctx.preferencesUrl },
    },
    { appUrl: ctx.appUrl },
  );
  return { subject: input.subject, ...rendered };
}
