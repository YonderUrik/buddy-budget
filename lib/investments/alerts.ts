/**
 * Avvisi di prezzo (Fase 6): quando scatta un avviso e che cosa dice l'email. Puro, senza database: la valutazione
 * serale che li legge e li segna sta in `alerts-run.ts`.
 */

import { renderEmail } from "@/lib/email";
import type { PriceAlertDirection } from "@/lib/db/schema/investments";

export const ALERT_DIRECTION_LABELS: Record<PriceAlertDirection, string> = { sopra: "sale sopra", sotto: "scende sotto" };

/** Un avviso scatta quando la chiusura raggiunge o supera il livello (sopra) o lo raggiunge o scende sotto (sotto). */
export function isAlertTriggered(direction: PriceAlertDirection, targetPrice: number, close: number): boolean {
  return direction === "sopra" ? close >= targetPrice : close <= targetPrice;
}

/** Prezzo formattato nella valuta dello strumento (fino a 4 decimali per i titoli a prezzo basso). */
export function formatAlertPrice(value: number, currency: string): string {
  const fractionDigits = Math.abs(value) < 10 ? 4 : 2;
  try {
    return new Intl.NumberFormat("it-IT", {
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
}

/** Oggetto, testo e HTML dell'email di un avviso scattato. Pura, per poterla testare. */
export function alertEmailContent(params: AlertEmailParams): { subject: string; text: string; html: string } {
  const target = formatAlertPrice(params.targetPrice, params.currency);
  const close = formatAlertPrice(params.closePrice, params.currency);
  const verb = ALERT_DIRECTION_LABELS[params.direction];
  return {
    subject: `Avviso di prezzo: ${params.instrumentName} ${verb} ${target}`,
    ...renderEmail(
      {
        title: "Avviso di prezzo",
        lead: `${params.instrumentName} ${verb} ${target}. Ultima chiusura: **${close}** (${params.closeDate}).`,
        cta: { label: "Guarda il titolo", url: `${params.appUrl}/investimenti/titoli/${params.instrumentId}` },
        footnote: "L'avviso è scattato una volta e non si ripete: puoi crearne uno nuovo dalla pagina del titolo. Questa non è una raccomandazione di investimento.",
      },
      { appUrl: params.appUrl },
    ),
  };
}
