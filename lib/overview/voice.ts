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
const DAY_MONTH = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long" });

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
  const money = (n: number) => formatCurrency(n, currency, { maximumFractionDigits: 0 });
  const lines: VoiceLine[] = [];

  const diff = pace.typicalSoFar === null ? null : pace.spentSoFar - pace.typicalSoFar;
  const tolerance = pace.typicalSoFar === null ? 0 : Math.max(pace.typicalSoFar * VOICE_PACE_TOLERANCE, 1);
  if (diff === null || pace.typicalSoFar === null) {
    lines.push({ key: "pace", segments: [{ text: `${capitalize(monthLabel)}: finora hai speso ` }, { text: money(pace.spentSoFar), strong: true }, { text: "." }] });
  } else if (Math.abs(diff) <= tolerance) {
    lines.push({ key: "pace", segments: [{ text: `${capitalize(monthLabel)} procede in linea con il solito: ` }, { text: money(pace.spentSoFar), strong: true }, { text: " spesi." }] });
  } else {
    const above = diff > 0;
    lines.push({
      key: "pace",
      segments: [
        { text: `${capitalize(monthLabel)} è partito ${above ? "sopra" : "sotto"} il solito: ` },
        { text: money(pace.spentSoFar), strong: true },
        { text: " spesi, " },
        { text: `${money(Math.abs(diff))} ${above ? "in più" : "in meno"}`, strong: true },
        { text: " della tua media a questo punto." },
      ],
    });
  }

  if (nextDue) {
    const days = Math.round((new Date(`${nextDue.date}T00:00:00`).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / MS_PER_DAY);
    if (days <= VOICE_DUE_HORIZON_DAYS) {
      const when = days < 0 ? "è scaduta" : days === 0 ? "scade oggi" : `scade il ${DAY_MONTH.format(new Date(`${nextDue.date}T00:00:00`))}`;
      lines.push({ key: "due", segments: [{ text: `La rata ${nextDue.name} ${when}: ` }, { text: money(nextDue.amount), strong: true }, { text: "." }] });
    }
  }
  return lines;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
