/**
 * Avvisi di prezzo (Fase 6): quando scatta un avviso e che cosa dice l'email. Puro, senza database: la valutazione
 * serale che li legge e li segna sta in `alerts-run.ts`.
 */

import { emailLocale, renderEmail } from "@/lib/email";
import type { Language } from "@/lib/localization/config";
import type { PriceAlertDirection } from "@/lib/db/schema/investments";

export const ALERT_DIRECTION_LABELS: Record<PriceAlertDirection, string> = { sopra: "sale sopra", sotto: "scende sotto" };

/** Un avviso scatta quando la chiusura raggiunge o supera il livello (sopra) o lo raggiunge o scende sotto (sotto). */
export function isAlertTriggered(direction: PriceAlertDirection, targetPrice: number, close: number): boolean {
  return direction === "sopra" ? close >= targetPrice : close <= targetPrice;
}

/** Price in the instrument's currency and the reader's locale (up to 4 decimals for low-priced securities). */
export function formatAlertPrice(value: number, currency: string, locale = "it-IT"): string {
  const fractionDigits = Math.abs(value) < 10 ? 4 : 2;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  } catch {
    return `${value.toFixed(fractionDigits)} ${currency}`;
  }
}

export interface AlertEmailParams {
  instrumentName: string;
  currency: string;
  direction: PriceAlertDirection;
  targetPrice: number;
  closePrice: number;
  closeDate: string;
  appUrl: string;
  instrumentId: string;
  /** Recipient's interface language; Italian when absent. */
  language?: Language;
}

/**
 * Subject, text and HTML of the email for a triggered alert, in `params.language` (Italian by default) with prices and
 * date in its locale. Pure, so it can be tested.
 */
export function alertEmailContent(params: AlertEmailParams): { subject: string; text: string; html: string } {
  const { t, locale, language } = emailLocale(params.language);
  const target = formatAlertPrice(params.targetPrice, params.currency, locale);
  const close = formatAlertPrice(params.closePrice, params.currency, locale);
  const name = params.instrumentName;
  const above = params.direction === "sopra";
  // Italian keeps the ISO close date it always had; English and German get a written date.
  const closeDate =
    language === "it" ? params.closeDate : new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${params.closeDate}T12:00:00Z`));
  const move = above ? t("{0} sale sopra {1}", name, target) : t("{0} scende sotto {1}", name, target);
  return {
    subject: above ? t("Avviso di prezzo: {0} sale sopra {1}", name, target) : t("Avviso di prezzo: {0} scende sotto {1}", name, target),
    ...renderEmail(
      {
        title: t("Avviso di prezzo"),
        lead: t("{0}. Ultima chiusura: **{1}** ({2}).", move, close, closeDate),
        cta: { label: t("Guarda il titolo"), url: `${params.appUrl}/investimenti/titoli/${params.instrumentId}` },
        footnote: t("L'avviso è scattato una volta e non si ripete: puoi crearne uno nuovo dalla pagina del titolo. Questa non è una raccomandazione di investimento."),
      },
      { appUrl: params.appUrl, language },
    ),
  };
}
