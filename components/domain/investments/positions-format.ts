/** Formattazione e note sul prezzo delle posizioni aperte, separate dalla UI così restano testabili. */

import type { PositionRow } from "@/lib/calc/investments";
import type { ConcentrationInsight } from "@/lib/investments/insights";
import { localizedFormats } from "@/lib/localization/format";

export interface PriceNote {
  /** Ultimo prezzo con la valuta dello strumento; null se manca. */
  price: string | null;
  /** Data e origine ("2 ott · manuale"), oppure l'invito a inserire il prezzo se manca. */
  detail: string;
  stale: boolean;
  /** Suggerimento mostrato solo quando un prezzo automatico è fermo. */
  hint: string | null;
}
import { translate, type MessageValues } from "@/lib/localization/messages";
import { LANGUAGE_LOCALES, type Language } from "@/lib/localization/config";

/** Bind presentation text and formatting to one language without shared mutable state. */
export function localizedPositionFormats(language: Language) {
  const locale = LANGUAGE_LOCALES[language];
  const { formatShortDate } = localizedFormats(locale);
  const tr = (source: string, values?: MessageValues) => translate(language, source, values);
const STALE_PRICE_DAYS = 4;

/** Testo mostrato quando un prezzo aggiornato in automatico è fermo: la fonte potrebbe non conoscere quel simbolo. */
const STALE_AUTO_PRICE_HINT = tr("La fonte non lo aggiorna: puoi inserire il prezzo a mano.");

const QUANTITY_FORMAT = new Intl.NumberFormat(locale, { maximumFractionDigits: 6 });
const PRICE_FORMAT = new Intl.NumberFormat(locale, { maximumFractionDigits: 4 });

const MS_PER_DAY = 86_400_000;

function daysBetween(dateKey: string, todayKey: string): number {
  return Math.round((Date.parse(`${todayKey}T00:00:00Z`) - Date.parse(`${dateKey}T00:00:00Z`)) / MS_PER_DAY);
}

/** "56%" da una quota 0-1. */
function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** Frase di lettura della concentrazione, o null se non c'è nulla da dire. */
function concentrationText(insight: ConcentrationInsight | null): string | null {
  if (!insight) return null;
  if (insight.kind === "single") return tr("Tutto il portafoglio è in un solo strumento.");
  if (insight.kind === "dominant") return tr("Il {0} è in {1}: gran parte dell'andamento dipende da lì.", { 0: percent(insight.share), 1: insight.name });
  return tr("Le prime tre posizioni pesano il {0} del portafoglio.", { 0: percent(insight.share) });
}

/** Ultimo prezzo della posizione con data e origine: un prezzo vecchio o stimato si vede, non si nasconde. */
function priceNote(row: PositionRow, todayKey: string): PriceNote {
  if (!row.lastPrice) return { price: null, detail: tr("Nessun prezzo: inseriscilo a mano"), stale: true, hint: null };
  const { close, date, origin } = row.lastPrice;
  const stale = daysBetween(date, todayKey) > STALE_PRICE_DAYS;
  const originText = origin === "manuale" ? tr(" · manuale") : origin === "operazione" ? tr(" · dall'ultima operazione") : "";
  return {
    price: `${PRICE_FORMAT.format(close)} ${row.instrument.currency}`,
    detail: `${formatShortDate(date)}${originText}`,
    stale,
    hint: stale && origin !== "manuale" && origin !== "operazione" ? STALE_AUTO_PRICE_HINT : null,
  };
}
  return { STALE_PRICE_DAYS, STALE_AUTO_PRICE_HINT, QUANTITY_FORMAT, PRICE_FORMAT, percent, concentrationText, priceNote };
}

/** Italian defaults retained for existing callers and pure calculation tests. */
export const { STALE_PRICE_DAYS, STALE_AUTO_PRICE_HINT, QUANTITY_FORMAT, PRICE_FORMAT, percent, concentrationText, priceNote } = localizedPositionFormats("it");
