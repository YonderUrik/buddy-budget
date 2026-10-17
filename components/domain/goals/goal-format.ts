import { isMonthKey } from "@/lib/goals/plan";
import type { GoalView } from "@/lib/goals/view";
import type { MessageValues } from "@/lib/localization/messages";

/** Traduttore come lo dà `useLocalization().t`. */
export type Translate = (source: string, values?: MessageValues) => string;

/** Formattatori che servono ai testi degli obiettivi, già legati a lingua e valuta. */
export interface GoalFormatters {
  money: (value: number) => string;
  /** «giugno 2027» da AAAA-MM o AAAA-MM-GG. */
  month: (key: string) => string;
}

/** Crea i formattatori per una lingua (`locale`) e una valuta, a partire dal formattatore di valuta dell'app. */
export function goalFormatters(locale: string, formatCurrency: (value: number, currency: string, options?: Intl.NumberFormatOptions) => string, currency: string): GoalFormatters {
  const monthFormat = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  return {
    money: (value) => formatCurrency(value, currency, { maximumFractionDigits: 0 }),
    // An incomplete key would be an Invalid Date, and formatting it throws: show it as it is instead.
    month: (key) => (isMonthKey(key.slice(0, 7)) ? monthFormat.format(new Date(`${key.slice(0, 7)}-01T12:00:00Z`)) : key),
  };
}

/** Di quanto un obiettivo sposta il traguardo, in parole; null se non si sa. */
export function fireShiftText(goal: Pick<GoalView, "fireShiftMonths" | "status">, tr: Translate): string | null {
  const months = goal.fireShiftMonths;
  if (months === null || goal.status === "raggiunto") return null;
  if (months <= 0) return tr("non sposta il traguardo");
  if (months < 12) return months === 1 ? tr("sposta il traguardo di 1 mese") : tr("sposta il traguardo di {0} mesi", { 0: months });
  const years = Math.round(months / 12);
  return years === 1 ? tr("sposta il traguardo di circa 1 anno") : tr("sposta il traguardo di circa {0} anni", { 0: years });
}

/** Stato in una parola, per l'etichetta colorata della riga. */
export function statusLabel(goal: Pick<GoalView, "status">, tr: Translate): string | null {
  switch (goal.status) {
    case "raggiunto":
      return tr("Raggiunto");
    case "in_linea":
      return tr("In linea");
    case "in_ritardo":
      return tr("In ritardo");
    default:
      return null;
  }
}

/** Frase che dice a che punto è un obiettivo: quando ci arrivi, se in tempo, e cosa servirebbe. */
export function statusSentence(goal: GoalView, fmt: GoalFormatters, tr: Translate): string {
  if (goal.status === "raggiunto") {
    return goal.achievedAt ? tr("Segnato come raggiunto: non prende più niente dal risparmio del mese.") : tr("I soldi ci sono tutti: puoi segnarlo come raggiunto.");
  }
  if (goal.status === "fermo") {
    return goal.monthly <= 0
      ? tr("Nessuna quota al mese: scegline una per sapere quando ci arrivi.")
      : tr("Questo mese il risparmio non arriva fin qui: gli obiettivi più in alto prendono tutto.");
  }
  const pace = tr("al ritmo di {0} al mese ci arrivi a {1}", { 0: fmt.money(goal.funded), 1: fmt.month(goal.etaMonth!) });
  const partial = goal.funded + 0.5 < goal.monthly ? tr(" (ricevi {0} dei {1} che hai scelto)", { 0: fmt.money(goal.funded), 1: fmt.money(goal.monthly) }) : "";
  if (goal.status === "in_ritardo" && goal.targetDate) {
    return `${capitalize(pace)}${partial}${tr(", dopo {0}: servirebbero {1} al mese.", { 0: fmt.month(goal.targetDate), 1: fmt.money(goal.required ?? 0) })}`;
  }
  return `${capitalize(pace)}${partial}.`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
