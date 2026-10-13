import { translate } from "@/lib/localization/messages";
import { LANGUAGE_LOCALES, type Language } from "@/lib/localization/config";
import { formatCurrency } from "@/lib/format";
import type { MonthPace } from "@/lib/calc/month-pace";

/** Pezzo di frase: `strong` evidenzia le cifre che contano. */
export interface VoiceSegment {
  text: string;
  strong?: boolean;
}

export interface VoiceLine {
  key: string;
  segments: VoiceSegment[];
}

export interface VoiceInput {
  language?: Language;
  pace: MonthPace;
  /** Nome del mese già formattato ("ottobre"). */
  monthLabel: string;
  currency: string;
  /** Prossima rata in scadenza, se c'è. */
  nextDue: { name: string; date: string; amount: number } | null;
  today: Date;
}

/** Soglia relativa sotto cui la spesa si dice "in linea" con il solito. */
export const VOICE_PACE_TOLERANCE = 0.05;
/** Entro quanti giorni una scadenza merita una frase. */
export const VOICE_DUE_HORIZON_DAYS = 14;
const MS_PER_DAY = 86_400_000;


/** Saluto in base all'ora locale. */
export function greetingFor(hour: number): string {
  if (hour < 12) return "Buongiorno";
  if (hour < 18) return "Buon pomeriggio";
  return "Buonasera";
}

/**
 * Le frasi con cui la Panoramica "parla": come va il mese rispetto al solito, e la prossima scadenza vicina.
 * Una frase compare solo se ha qualcosa da dire; senza storico non si inventa un confronto.
 */
export function buildVoiceLines(input: VoiceInput): VoiceLine[] {
  const { pace, monthLabel, currency, nextDue, today } = input;
  const language = input.language ?? "it";
  const locale = LANGUAGE_LOCALES[language];
  const tr = (source: string, values?: Record<string, string>) => translate(language, source, values);
  const DAY_MONTH = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" });
  const money = (n: number) => formatCurrency(n, currency, { locale, maximumFractionDigits: 0 });
  const lines: VoiceLine[] = [];

  const diff = pace.typicalSoFar === null ? null : pace.spentSoFar - pace.typicalSoFar;
  const tolerance = pace.typicalSoFar === null ? 0 : Math.max(pace.typicalSoFar * VOICE_PACE_TOLERANCE, 1);
  if (diff === null || pace.typicalSoFar === null) {
    lines.push({ key: "pace", segments: [{ text: tr("{month}: finora hai speso ", { month: capitalize(monthLabel) }) }, { text: money(pace.spentSoFar), strong: true }, { text: "." }] });
  } else if (Math.abs(diff) <= tolerance) {
    lines.push({ key: "pace", segments: [{ text: tr("{month} procede in linea con il solito: ", { month: capitalize(monthLabel) }) }, { text: money(pace.spentSoFar), strong: true }, { text: tr(" spesi.") }] });
  } else {
    const above = diff > 0;
    lines.push({
      key: "pace",
      segments: [
        { text: tr(above ? "{month} è partito sopra il solito: " : "{month} è partito sotto il solito: ", { month: capitalize(monthLabel) }) },
        { text: money(pace.spentSoFar), strong: true },
        { text: tr(" spesi, ") },
        { text: tr(above ? "{amount} in più" : "{amount} in meno", { amount: money(Math.abs(diff)) }), strong: true },
        { text: tr(" della tua media a questo punto.") },
      ],
    });
  }

  if (nextDue) {
    const days = Math.round((new Date(`${nextDue.date}T00:00:00`).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / MS_PER_DAY);
    if (days <= VOICE_DUE_HORIZON_DAYS) {
      const when = days < 0 ? tr("è scaduta") : days === 0 ? tr("scade oggi") : tr("scade il {date}", { date: DAY_MONTH.format(new Date(`${nextDue.date}T00:00:00`)) });
      lines.push({ key: "due", segments: [{ text: tr("La rata {name} {when}: ", { name: nextDue.name, when }) }, { text: money(nextDue.amount), strong: true }, { text: "." }] });
    }
  }
  return lines;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
