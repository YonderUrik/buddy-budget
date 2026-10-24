import { translate } from "@/lib/localization/messages";
import { LANGUAGE_LOCALES, type Language } from "@/lib/localization/config";
import { formatCurrency } from "@/lib/format";
import type { MonthPace } from "@/lib/calc/month-pace";

/** Piece of a line: `strong` highlights the figures that matter, `tone` colours a gap from the usual (above = neg). */
export interface VoiceSegment {
  text: string;
  strong?: boolean;
  tone?: "pos" | "neg";
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
 * The short lines under the Panoramica greeting: what the month has cost so far against the usual, and the next
 * instalment due soon. One line each, short enough to fit a phone row («Ottobre: 2662 € spesi, +880 € sul solito»).
 * A line appears only when it has something to say: without history there is no comparison, and with no spending and
 * no history nothing is said about the month.
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
  // Nothing spent and no history (a new user, or no transactions yet): «0 € spesi» would say nothing.
  if (pace.typicalSoFar !== null || pace.spentSoFar !== 0) {
    const spent: VoiceSegment[] = [
      { text: tr("{month}: ", { month: capitalize(monthLabel) }) },
      { text: money(pace.spentSoFar), strong: true },
      { text: tr(" spesi") },
    ];
    if (diff === null) {
      lines.push({ key: "pace", segments: spent });
    } else if (Math.abs(diff) <= tolerance) {
      lines.push({ key: "pace", segments: [...spent, { text: tr(", come al solito") }] });
    } else {
      const above = diff > 0;
      lines.push({
        key: "pace",
        segments: [
          ...spent,
          { text: ", " },
          { text: `${above ? "+" : "−"}${money(Math.abs(diff))}`, strong: true, tone: above ? "neg" : "pos" },
          { text: tr(" sul solito") },
        ],
      });
    }
  }

  if (nextDue) {
    const days = Math.round((new Date(`${nextDue.date}T00:00:00`).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / MS_PER_DAY);
    if (days <= VOICE_DUE_HORIZON_DAYS) {
      const when = days < 0 ? tr(", scaduta") : days === 0 ? tr(" oggi") : tr(" il {date}", { date: DAY_MONTH.format(new Date(`${nextDue.date}T00:00:00`)) });
      lines.push({ key: "due", segments: [{ text: tr("Rata {name}: ", { name: nextDue.name }) }, { text: money(nextDue.amount), strong: true }, { text: when }] });
    }
  }
  return lines;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
