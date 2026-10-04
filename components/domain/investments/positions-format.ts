/** Formattazione e note sul prezzo delle posizioni aperte, separate dalla UI così restano testabili. */

import type { PositionRow } from "@/lib/calc/investments";
import type { ConcentrationInsight } from "@/lib/investments/insights";
import { formatShortDate } from "@/lib/format";

/** Oltre questi giorni un prezzo è segnalato come vecchio. */
export const STALE_PRICE_DAYS = 4;

/** Testo mostrato quando un prezzo aggiornato in automatico è fermo: la fonte potrebbe non conoscere quel simbolo. */
export const STALE_AUTO_PRICE_HINT = "La fonte non lo aggiorna: puoi inserire il prezzo a mano.";

export const QUANTITY_FORMAT = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 6 });
export const PRICE_FORMAT = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 4 });

const MS_PER_DAY = 86_400_000;

function daysBetween(dateKey: string, todayKey: string): number {
  return Math.round((Date.parse(`${todayKey}T00:00:00Z`) - Date.parse(`${dateKey}T00:00:00Z`)) / MS_PER_DAY);
}

/** "56%" da una quota 0-1. */
export function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** Frase di lettura della concentrazione, o null se non c'è nulla da dire. */
export function concentrationText(insight: ConcentrationInsight | null): string | null {
  if (!insight) return null;
  if (insight.kind === "single") return "Tutto il portafoglio è in un solo strumento.";
  if (insight.kind === "dominant") return `Il ${percent(insight.share)} è in ${insight.name}: gran parte dell'andamento dipende da lì.`;
  return `Le prime tre posizioni pesano il ${percent(insight.share)} del portafoglio.`;
}

export interface PriceNote {
  /** Ultimo prezzo con la valuta dello strumento; null se manca. */
  price: string | null;
  /** Data e origine ("2 ott · manuale"), oppure l'invito a inserire il prezzo se manca. */
  detail: string;
  stale: boolean;
  /** Suggerimento mostrato solo quando un prezzo automatico è fermo. */
  hint: string | null;
}

/** Ultimo prezzo della posizione con data e origine: un prezzo vecchio o stimato si vede, non si nasconde. */
export function priceNote(row: PositionRow, todayKey: string): PriceNote {
  if (!row.lastPrice) return { price: null, detail: "Nessun prezzo: inseriscilo a mano", stale: true, hint: null };
  const { close, date, origin } = row.lastPrice;
  const stale = daysBetween(date, todayKey) > STALE_PRICE_DAYS;
  const originText = origin === "manuale" ? " · manuale" : origin === "operazione" ? " · dall'ultima operazione" : "";
  return {
    price: `${PRICE_FORMAT.format(close)} ${row.instrument.currency}`,
    detail: `${formatShortDate(date)}${originText}`,
    stale,
    hint: stale && origin !== "manuale" && origin !== "operazione" ? STALE_AUTO_PRICE_HINT : null,
  };
}
