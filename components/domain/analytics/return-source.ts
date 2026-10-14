/** Testi che spiegano da dove viene il rendimento usato in Analitiche (storico, valore prudente o scelto a mano). */

import { ASSUMPTION_LIMITS, DEFAULT_ASSUMPTIONS } from "@/lib/analitiche/assumptions";
import { HIGH_RETURN_WARNING, MIN_INVESTED_FOR_ESTIMATE, type ExpectedReturnInfo, type MissingReason } from "@/lib/analitiche/historical-return";
import type { DataPeriod } from "@/lib/analitiche/period";
import { localizedAnalyticsFormats } from "./analytics-format";
import { localizedPeriodText } from "./period-text";

export { HIGH_RETURN_WARNING };
import { translate, type MessageValues } from "@/lib/localization/messages";
import { type Language } from "@/lib/localization/config";

/** Bind presentation text and formatting to one language without shared mutable state. */
export function localizedReturnSource(language: Language) {
  const { money, pct } = localizedAnalyticsFormats(language);
  const { monthText } = localizedPeriodText(language);
  const tr = (source: string, values?: MessageValues) => translate(language, source, values);
const MISSING_TEXT: Record<MissingReason, (currency: string) => string> = {
  "nessun-investimento": () => tr("senza investimenti registrati non c'è un tuo rendimento da cui partire"),
  "storico-breve": () => tr("per partire dal tuo rendimento servono almeno 12 mesi di investimenti nel periodo scelto"),
  "periodo-breve": () => tr("per calcolare un rendimento annuo serve un periodo di almeno 12 mesi"),
  "patrimonio-basso": (currency) => tr("con meno di {0} investiti il tuo rendimento dice poco", { 0: money(MIN_INVESTED_FOR_ESTIMATE, currency) }),
  "prezzi-mancanti": () => tr("alcuni titoli non hanno un prezzo e il tuo rendimento non sarebbe affidabile"),
};

/** Una frase sull'origine del rendimento in uso, per la riga sotto il cursore e per «Tutte le ipotesi». */
function returnSourceText(info: ExpectedReturnInfo, currency: string, period: DataPeriod): string {
  const { history } = info;
  if (info.source === "manuale") return tr("Inserito a mano.");
  if (info.source === "prudente") {
    const reason = history.status === "manca" ? MISSING_TEXT[history.reason](currency) : "";
    return tr("Uso un {0} prudente: {1}.", { 0: pct(DEFAULT_ASSUMPTIONS.expectedReturn, 0), 1: reason });
  }
  if (history.status !== "ok" || info.historyReal === null) return "";
  const clamped = info.clamped ? tr(" Uso {0}, il limite del cursore.", { 0: pct(info.value) }) : "";
  const when = history.shorterThanPeriod
    ? tr("negli ultimi {0} mesi (da quando investi)", { 0: history.months })
    : period.kind === "ultimi"
      ? tr("negli ultimi {0} mesi", { 0: period.months })
      : tr("da {0} a {1}", { 0: monthText(history.fromKey), 1: monthText(history.toKey) });
  return tr("Il tuo portafoglio {0} ha reso {1} l'anno, {2} tolta l'inflazione.{3}", { 0: when, 1: pct(history.nominal), 2: pct(info.historyReal), 3: clamped });
}

/** Etichetta breve dell'origine del rendimento, per la riga sotto il cursore. */
function returnSourceLabel(info: ExpectedReturnInfo): string {
  return info.source === "manuale" ? tr("Scritto a mano") : info.source === "prudente" ? tr("Valore prudente") : tr("Dai tuoi dati");
}

/** Rendimento dello storico da proporre a chi ne ha scelto uno a mano, o null se non c'è. */
function historyOffer(info: ExpectedReturnInfo): number | null {
  if (info.source !== "manuale" || info.historyReal === null) return null;
  const { min, max } = ASSUMPTION_LIMITS.expectedReturn;
  return Math.min(Math.max(info.historyReal, min), max);
}

/** Avviso per un rendimento sopra la soglia di prudenza (non blocca nulla). */
const HIGH_RETURN_TEXT = tr("Sopra {0} reale le proiezioni diventano ottimistiche: nel lungo periodo le borse mondiali hanno reso in media intorno al 5% reale.", { 0: pct(HIGH_RETURN_WARNING, 0) });
  return { returnSourceText, returnSourceLabel, historyOffer, HIGH_RETURN_TEXT };
}

/** Italian defaults retained for existing callers and pure calculation tests. */
export const { returnSourceText, returnSourceLabel, historyOffer, HIGH_RETURN_TEXT } = localizedReturnSource("it");
