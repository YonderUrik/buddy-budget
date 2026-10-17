import { renderEmail, emailLocale, type EmailFooter, type EmailLocale, type EmailSection } from "@/lib/email";
import { formatLongDate } from "@/lib/format";
import { formatPeriodLabel, getPeriodRange } from "@/lib/calc/expenses";
import type { Language } from "@/lib/localization/config";
import { NOTIFICATION_KIND_INFO, type NotificationKind } from "./constants";
import type { BudgetAlert, DeadlineAlert } from "./alerts";
import type { DigestData, DigestPeriod } from "./digest";
import type { InvestmentDigest } from "./investments-digest";
import type { GoalEmailRow, GoalNotice, GoalsDigest } from "./goals";

/** Formatta un importo (già nascosto, se l'utente ha scelto «nascondi importi»). */
export type MoneyFormatter = (value: number) => string;

export interface EmailContext {
  appUrl: string;
  /** Formats an amount in the recipient's currency and locale (already masked with «hide amounts»). */
  money: MoneyFormatter;
  /** Indirizzi del piè di pagina: link di disiscrizione dedicato al tipo di email e pagina delle preferenze. */
  unsubscribeUrl: string;
  preferencesUrl: string;
  /** Recipient's interface language; Italian when absent. */
  language?: Language;
}

export interface BuiltEmail {
  subject: string;
  text: string;
  html: string;
}

/** Percorso delle preferenze in Impostazioni (sezione Notifiche). */
export const NOTIFICATION_SETTINGS_PATH = "/impostazioni?sezione=notifiche#impostazioni-notifiche";

function footerFor(kind: NotificationKind, ctx: EmailContext, { t }: EmailLocale): EmailFooter {
  return { kind: "optional", reason: t(NOTIFICATION_KIND_INFO[kind].reason), unsubscribeUrl: ctx.unsubscribeUrl, preferencesUrl: ctx.preferencesUrl };
}

function percentChange(current: number, previous: number): number | null {
  return previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
}

/** Signed percentage of the period gain in the recipient's locale (`+1,3%`, `+1.3%`, `+1,3 %`). */
function signedPercent(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" }).format(value);
}

/** Change of spending against the previous period, in whole percent: Italian keeps its historic `+12%` form. */
function changePercent(change: number, { language, locale }: EmailLocale): string {
  return language === "it" ? `${change > 0 ? "+" : ""}${change}%` : signedPercent(change / 100, locale);
}

/** Importo con il segno davanti (`+120 €`); con «nascondi importi» resta la sola maschera, senza svelare il segno. */
function signedMoney(value: number, money: MoneyFormatter): string {
  const formatted = money(value);
  return value > 0 && !formatted.includes("•") ? `+${formatted}` : formatted;
}

/** Name of the digest period in the recipient's locale: the Italian label comes ready from `digestPeriod`. */
function periodLabel(period: DigestPeriod, { language, locale }: EmailLocale): string {
  return language === "it" ? period.label : formatPeriodLabel(period.period, getPeriodRange(period.period, period.referenceDate), locale);
}

/** Righe «Liquidità» del riepilogo: entrate, uscite, quanto è rimasto, il confronto e la voce più pesante. */
function liquidityRows(data: DigestData, money: MoneyFormatter, l: EmailLocale): EmailSection["rows"] {
  const { t, tc } = l;
  const { spent, income, previousSpent, topCategories, budget } = data;
  const change = percentChange(spent, previousSpent);
  const top = topCategories[0];
  return [
    { label: t("Entrate"), value: money(income) },
    { label: t("Uscite"), value: money(spent) },
    { label: income - spent >= 0 ? t("Messi da parte") : t("Speso più delle entrate"), value: money(Math.abs(income - spent)) },
    ...(change === null
      ? []
      : [{ label: data.period.period === "mese" ? t("Uscite rispetto al mese prima") : t("Uscite rispetto alla settimana prima"), value: Math.abs(change) < 1 ? tc("in linea") : changePercent(change, l) }]),
    ...(top ? [{ label: t("Voce più pesante"), value: `${top.name} · ${money(top.amount)}` }] : []),
    ...(budget === null ? [] : [{ label: t("Budget superati"), value: tc("{0} su {1}", budget.over, budget.total) }]),
  ];
}

/** Righe «Investimenti» del riepilogo: valore, guadagno del periodo, proventi e versamenti (questi ultimi solo se ci sono). */
function investmentRows(investments: InvestmentDigest, money: MoneyFormatter, { t, locale }: EmailLocale): EmailSection["rows"] {
  const { endValue, gain, twr, income, netContributions } = investments;
  return [
    { label: t("Valore a fine periodo"), value: money(endValue) },
    { label: t("Guadagno del periodo"), value: `${signedMoney(gain, money)}${twr === null ? "" : ` (${signedPercent(twr, locale)})`}` },
    ...(income > 0 ? [{ label: t("Dividendi e cedole"), value: money(income) }] : []),
    ...(Math.abs(netContributions) >= 0.5 ? [{ label: netContributions > 0 ? t("Investiti nel periodo") : t("Ritirati nel periodo"), value: money(Math.abs(netContributions)) }] : []),
  ];
}

/** Sentence on the investments of the period: gain or loss, with the dividends and coupons when there are some. */
function investmentSentence(investments: InvestmentDigest, money: MoneyFormatter, { t }: EmailLocale): string {
  const gain = money(Math.abs(investments.gain));
  if (investments.income > 0) {
    const income = money(investments.income);
    return investments.gain >= 0
      ? t("I tuoi investimenti hanno guadagnato **{0}**, di cui **{1}** di dividendi e cedole.", gain, income)
      : t("I tuoi investimenti hanno perso **{0}**, di cui **{1}** di dividendi e cedole.", gain, income);
  }
  return investments.gain >= 0 ? t("I tuoi investimenti hanno guadagnato **{0}**.", gain) : t("I tuoi investimenti hanno perso **{0}**.", gain);
}

/**
 * Periodic summary email: one sentence with the essentials and two short groups, Cash and Investments, with the figures
 * the app already computes. No advice and no judgement on the numbers. Pure, so it can be tested; written in
 * `ctx.language`.
 */
export function digestEmail(data: DigestData, ctx: EmailContext): BuiltEmail {
  const l = emailLocale(ctx.language);
  const { t, tc, language } = l;
  const { period, spent, income, movements, investments, toDecide = 0, goals = null } = data;
  const monthly = period.period === "mese";
  const label = periodLabel(period, l);
  // Italian writes the month in lower case («a settembre»); English and German keep the capital letter.
  const month = (language === "it" ? label.toLowerCase() : label).replace(/ \d{4}$/, "");
  const opening = monthly ? tc("A {0}", month) : t("Nella settimana {0}", label);
  const sentences = [
    movements > 0 ? t("{0} hai speso **{1}** e incassato **{2}**.", opening, ctx.money(spent), ctx.money(income)) : t("{0} non hai movimenti sui conti.", opening),
    investments === null ? null : investmentSentence(investments, ctx.money, l),
    toDecide > 0 ? (toDecide === 1 ? t("**Un movimento** aspetta una categoria in Categorizza.") : t("**{0} movimenti** aspettano una categoria in Categorizza.", toDecide)) : null,
  ].filter((s): s is string => s !== null);
  const sections: EmailSection[] = [
    ...(movements > 0 ? [{ title: t("Liquidità"), rows: liquidityRows(data, ctx.money, l) }] : []),
    ...(investments ? [{ title: t("Investimenti"), rows: investmentRows(investments, ctx.money, l) }] : []),
    ...(goals ? [{ title: t("Obiettivi"), rows: goalsRows(goals, ctx.money, l) }] : []),
  ];
  const rendered = renderEmail(
    {
      title: monthly ? t("Riepilogo di {0}", language === "it" ? label.toLowerCase() : label) : t("Riepilogo della settimana {0}", label),
      lead: sentences.join(" "),
      preheader: monthly ? t("Il tuo mese in poche righe: conti e investimenti.") : t("La tua settimana in poche righe: conti e investimenti."),
      sections,
      footnote: investments ? t("Il guadagno degli investimenti è al netto di quanto hai comprato o venduto nel periodo, con i prezzi di chiusura.") : undefined,
      cta: { label: t("Apri la Panoramica"), url: `${ctx.appUrl}/panoramica` },
      footer: footerFor("digest", ctx, l),
    },
    { appUrl: ctx.appUrl, language },
  );
  return { subject: monthly ? t("Il riepilogo del tuo mese") : t("Il riepilogo della tua settimana"), ...rendered };
}

/** «giugno 2027» (or «June 2027», «Juni 2027») from YYYY-MM or YYYY-MM-DD. */
function monthLabel(key: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${key.slice(0, 7)}-01T12:00:00Z`));
}

/** Pagina degli obiettivi, con l'origine per l'evento d'uso. */
export const GOALS_EMAIL_PATH = "/analitiche/obiettivi?da=email";

/** Una riga del promemoria: a che punto è e quando ci arrivi. */
function goalLine(goal: GoalEmailRow, money: MoneyFormatter, { t, locale }: EmailLocale): { label: string; value: string } {
  const when =
    goal.status === "in_ritardo" && goal.etaMonth && goal.targetDate
      ? t("in ritardo: a {0} invece di {1}", monthLabel(goal.etaMonth, locale), monthLabel(goal.targetDate, locale))
      : goal.etaMonth
        ? t("ci arrivi a {0}", monthLabel(goal.etaMonth, locale))
        : t("questo mese non riceve niente");
  return { label: goal.name, value: t("{0} di {1} · {2}", money(goal.current), money(goal.target), when) };
}

/**
 * Goals email: a goal reached, a near date that does not add up or the start-of-month reminder, all in one email. It
 * reminds that the money set aside is updated in the app (sources are labels, not transfers). Pure.
 */
export function goalsEmail(notice: GoalNotice, ctx: EmailContext): BuiltEmail {
  const l = emailLocale(ctx.language);
  const { t, locale, language } = l;
  const reached = notice.alerts.filter((a) => a.type === "raggiunto");
  const due = notice.alerts.filter((a) => a.type === "scadenza");
  const sentences: string[] = [];
  if (reached.length === 1) sentences.push(t("Hai messo da parte tutti i **{0}** di **{1}**. Segnalo come raggiunto per liberare la sua quota del mese.", ctx.money(reached[0].goal.target), reached[0].goal.name));
  if (reached.length > 1) sentences.push(t("Hai raggiunto **{0} obiettivi**: segnali come raggiunti per liberare le loro quote del mese.", reached.length));
  for (const { goal } of due) {
    const date = monthLabel(goal.targetDate!, locale);
    const missing = ctx.money(Math.max(0, goal.target - goal.current));
    sentences.push(
      goal.required
        ? t("**{0}** ha la data a **{1}** e mancano **{2}**: servirebbero {3} al mese. Puoi spostare la data o aumentare la quota.", goal.name, date, missing, ctx.money(goal.required))
        : t("**{0}** ha la data a **{1}** e mancano **{2}**. Puoi spostare la data o aumentare la quota.", goal.name, date, missing),
    );
  }
  if (notice.reminder) {
    const { gap } = notice.reminder;
    sentences.push(
      gap > 0.5
        ? t("Ecco a che punto sono i tuoi obiettivi a inizio mese. Il risparmio non basta per tutte le quote: ne mancano **{0}** al mese. Se hai spostato soldi su un conto o comprato titoli per un obiettivo, aggiorna quanto hai messo da parte.", ctx.money(gap))
        : t("Ecco a che punto sono i tuoi obiettivi a inizio mese. Se hai spostato soldi su un conto o comprato titoli per un obiettivo, aggiorna quanto hai messo da parte."),
    );
  }
  const rendered = renderEmail(
    {
      title:
        reached.length > 1
          ? t("Hai raggiunto {0} obiettivi", reached.length)
          : reached.length === 1
            ? t("Hai raggiunto un obiettivo")
            : due.length > 0
              ? t("Un obiettivo è vicino alla data")
              : t("I tuoi obiettivi a inizio mese"),
      lead: sentences.join(" "),
      preheader: reached.length > 1 ? t("Alcuni obiettivi di risparmio sono completi.") : reached.length === 1 ? t("Un obiettivo di risparmio è completo.") : t("A che punto sono i tuoi obiettivi di risparmio."),
      details: notice.reminder ? notice.reminder.goals.map((g) => goalLine(g, ctx.money, l)) : due.map((a) => goalLine(a.goal, ctx.money, l)),
      footnote: t("Le date sono al ritmo di oggi, con il risparmio medio dei tuoi ultimi mesi. Stime a scopo informativo."),
      cta: { label: t("Apri i tuoi obiettivi"), url: `${ctx.appUrl}${GOALS_EMAIL_PATH}` },
      footer: footerFor("goals", ctx, l),
    },
    { appUrl: ctx.appUrl, language },
  );
  const subject =
    reached.length > 1
      ? t("Hai raggiunto {0} obiettivi di risparmio", reached.length)
      : reached.length === 1
        ? t("Hai raggiunto un obiettivo di risparmio")
        : due.length > 0
          ? t("Un obiettivo si avvicina alla data")
          : t("I tuoi obiettivi di risparmio questo mese");
  return { subject, ...rendered };
}

/** Righe «Obiettivi» del riepilogo periodico. */
function goalsRows(goals: GoalsDigest, money: MoneyFormatter, { t, tc }: EmailLocale): EmailSection["rows"] {
  return [
    { label: t("Obiettivi aperti"), value: String(goals.open) },
    ...(goals.late > 0 ? [{ label: t("In ritardo"), value: String(goals.late) }] : []),
    ...(goals.nearest ? [{ label: t("Più vicino: {0}", goals.nearest.name), value: tc("{0} di {1}", money(goals.nearest.current), money(goals.nearest.target)) }] : []),
  ];
}

/** Budget alerts of the month: one email for several categories. Pure. */
export function budgetAlertEmail(alerts: BudgetAlert[], ctx: EmailContext): BuiltEmail {
  const l = emailLocale(ctx.language);
  const { t, language } = l;
  const exceeded = alerts.filter((a) => a.threshold >= 100).length;
  const percent = (a: BudgetAlert) => Math.round((a.spent / a.budget) * 100);
  const lead =
    alerts.length === 1
      ? t("Questo mese hai usato **{0}%** del budget di **{1}**: **{2}** su **{3}**.", percent(alerts[0]), alerts[0].name, ctx.money(alerts[0].spent), ctx.money(alerts[0].budget))
      : exceeded > 0
        ? t("Questo mese {0} categorie sono vicine al budget o lo hanno superato ({1} già sopra).", alerts.length, exceeded)
        : t("Questo mese {0} categorie sono vicine al budget o lo hanno superato.", alerts.length);
  const rendered = renderEmail(
    {
      title: t("Avviso sul budget"),
      lead,
      preheader: t("Una o più categorie hanno raggiunto il budget del mese."),
      details: alerts.length === 1 ? [] : alerts.map((a) => ({ label: a.name, value: t("{0}% · {1} su {2}", percent(a), ctx.money(a.spent), ctx.money(a.budget)) })),
      cta: { label: t("Guarda i budget"), url: `${ctx.appUrl}/liquidita` },
      footer: footerFor("budget", ctx, l),
    },
    { appUrl: ctx.appUrl, language },
  );
  return { subject: exceeded > 0 ? t("Hai superato un budget questo mese") : t("Sei vicino al limite di un budget"), ...rendered };
}

/** Alerts on loan instalments that are due soon or overdue. Pure. */
export function deadlineAlertEmail(alerts: DeadlineAlert[], ctx: EmailContext): BuiltEmail {
  const l = emailLocale(ctx.language);
  const { t, locale, language } = l;
  const when = (a: DeadlineAlert) => formatLongDate(new Date(`${a.date}T12:00:00Z`), locale);
  const overdue = alerts.some((a) => a.overdue);
  const [first] = alerts;
  const lead =
    alerts.length === 1
      ? first.overdue
        ? t("La rata di **{0}**: **{1}**, scaduta il **{2}**.", first.name, ctx.money(first.amount), when(first))
        : t("Sta per scadere la rata di **{0}**: **{1}**, il **{2}**.", first.name, ctx.money(first.amount), when(first))
      : t("Hai {0} rate in scadenza o scadute: la prima è quella di **{1}**, **{2}** il **{3}**.", alerts.length, first.name, ctx.money(first.amount), when(first));
  const rendered = renderEmail(
    {
      title: t("Rate in scadenza"),
      lead,
      preheader: t("Una rata dei tuoi finanziamenti è in scadenza."),
      details: alerts.length === 1 ? [] : alerts.map((a) => ({ label: `${a.name} · ${when(a)}`, value: ctx.money(a.amount) })),
      footnote: t("Le rate si segnano a mano nell'app: dopo il pagamento non compaiono più tra le prossime scadenze."),
      cta: { label: t("Apri i finanziamenti"), url: `${ctx.appUrl}/debiti/finanziamenti` },
      footer: footerFor("deadlines", ctx, l),
    },
    { appUrl: ctx.appUrl, language },
  );
  return { subject: overdue ? t("Hai una rata scaduta") : t("Una rata sta per scadere"), ...rendered };
}

/**
 * Announcement email for a new feature, sent once to every user only after the owner approves it. Pure: the screenshot,
 * the steps and the texts (already in the recipient's language) come from the caller. The footer always carries the
 * link to stop receiving announcements.
 */
export function featureAnnouncementEmail(
  input: { title: string; lead: string; steps: string[]; imageUrl: string; imageAlt: string; ctaLabel: string; ctaPath: string; subject: string },
  ctx: EmailContext,
): BuiltEmail {
  const { t, language } = emailLocale(ctx.language);
  const rendered = renderEmail(
    {
      title: input.title,
      lead: input.lead,
      image: { src: input.imageUrl, alt: input.imageAlt },
      steps: input.steps,
      cta: { label: input.ctaLabel, url: `${ctx.appUrl}${input.ctaPath}` },
      footer: { kind: "optional", reason: t("l'account BuddyBudget"), unsubscribeUrl: ctx.unsubscribeUrl, preferencesUrl: ctx.preferencesUrl },
    },
    { appUrl: ctx.appUrl, language },
  );
  return { subject: input.subject, ...rendered };
}
