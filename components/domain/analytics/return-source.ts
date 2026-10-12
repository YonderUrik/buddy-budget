/** Testi che spiegano da dove viene il rendimento usato in Analitiche (storico, valore prudente o scelto a mano). */

import { ASSUMPTION_LIMITS } from "@/lib/analitiche/assumptions";
import { HIGH_RETURN_WARNING, MIN_INVESTED_FOR_ESTIMATE, type ExpectedReturnInfo, type MissingReason } from "@/lib/analitiche/historical-return";
import type { DataPeriod } from "@/lib/analitiche/period";
import { money, pct } from "./analytics-format";
import { monthText } from "./period-text";

const MISSING_TEXT: Record<MissingReason, (currency: string) => string> = {
  "nessun-investimento": () => "senza investimenti registrati non c'è un tuo rendimento da cui partire",
  "storico-breve": () => "per partire dal tuo rendimento servono almeno 12 mesi di investimenti nel periodo scelto",
  "periodo-breve": () => "per calcolare un rendimento annuo serve un periodo di almeno 12 mesi",
  "patrimonio-basso": (currency) => `con meno di ${money(MIN_INVESTED_FOR_ESTIMATE, currency)} investiti il tuo rendimento dice poco`,
  "prezzi-mancanti": () => "alcuni titoli non hanno un prezzo e il tuo rendimento non sarebbe affidabile",
};

/** Una frase sull'origine del rendimento in uso, per la riga sotto il cursore e per «Tutte le ipotesi». */
export function returnSourceText(info: ExpectedReturnInfo, currency: string, period: DataPeriod): string {
  const { history } = info;
  if (info.source === "manuale") return "Inserito a mano.";
  if (info.source === "prudente") {
    const reason = history.status === "manca" ? MISSING_TEXT[history.reason](currency) : "";
    return `Valore prudente di partenza: ${reason}.`;
  }
  if (history.status !== "ok" || info.historyReal === null) return "";
  const clamped = info.clamped ? ` Uso ${pct(info.value)}, il limite del cursore.` : "";
  const when = history.shorterThanPeriod
    ? `negli ultimi ${history.months} mesi (da quando investi)`
    : period.kind === "ultimi"
      ? `negli ultimi ${period.months} mesi`
      : `da ${monthText(history.fromKey)} a ${monthText(history.toKey)}`;
  return `Dai tuoi dati: il portafoglio ${when} ha reso ${pct(history.nominal)} l'anno, ${pct(info.historyReal)} tolta l'inflazione.${clamped}`;
}

/** Rendimento dello storico da proporre a chi ne ha scelto uno a mano, o null se non c'è. */
export function historyOffer(info: ExpectedReturnInfo): number | null {
  if (info.source !== "manuale" || info.historyReal === null) return null;
  const { min, max } = ASSUMPTION_LIMITS.expectedReturn;
  return Math.min(Math.max(info.historyReal, min), max);
}

/** Avviso per un rendimento sopra la soglia di prudenza (non blocca nulla). */
export const HIGH_RETURN_TEXT = `Sopra ${pct(HIGH_RETURN_WARNING, 0)} reale le proiezioni diventano ottimistiche: nel lungo periodo le borse mondiali hanno reso in media intorno al 5% reale.`;

export { HIGH_RETURN_WARNING };
