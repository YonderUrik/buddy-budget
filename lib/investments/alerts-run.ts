import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/lib/db/client";
import { getAppUrl } from "@/lib/env";
import { authUser } from "@/lib/db/schema/auth";
import { instrumentPrices, instruments, userPriceAlerts } from "@/lib/db/schema/investments";
import { hashUserId, logger, type Logger } from "@/lib/observability";
import { alertEmailContent, isAlertTriggered } from "./alerts";

/** Riepilogo di un giro di controllo degli avvisi: solo conteggi. */
export interface AlertsSummary {
  checked: number;
  triggered: number;
  emailFailed: number;
}

/** Ultima chiusura salvata di uno strumento, o null. */
export async function latestClose(instrumentId: string): Promise<{ date: string; close: number } | null> {
  const [row] = await db
    .select({ date: instrumentPrices.date, close: instrumentPrices.close })
    .from(instrumentPrices)
    .where(eq(instrumentPrices.instrumentId, instrumentId))
    .orderBy(desc(instrumentPrices.date))
    .limit(1);
  return row ? { date: row.date, close: Number(row.close) } : null;
}

async function sendAlertEmail(to: string, content: { subject: string; text: string; html: string }): Promise<boolean> {
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: process.env.RESEND_FROM!,
    to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
  return !error;
}

/**
 * Cron serale (dopo l'aggiornamento dei prezzi): controlla gli avvisi attivi con l'ultima chiusura di ogni strumento,
 * segna come scattati quelli che hanno raggiunto il livello e manda un'email a chi li ha creati. Il passaggio
 * `attivo → scattato` è un UPDATE condizionato: con più pod solo uno vince e manda l'email, una volta sola.
 * Un errore dell'email non annulla lo scatto (l'avviso resta visibile nell'app). Non lancia mai.
 */
export async function evaluatePriceAlerts(options: { log?: Logger; send?: typeof sendAlertEmail } = {}): Promise<AlertsSummary> {
  const log = options.log ?? logger;
  const send = options.send ?? sendAlertEmail;
  const summary: AlertsSummary = { checked: 0, triggered: 0, emailFailed: 0 };
  try {
    const active = await db
      .select({
        alert: userPriceAlerts,
        instrumentName: instruments.name,
        currency: instruments.currency,
        email: authUser.email,
      })
      .from(userPriceAlerts)
      .innerJoin(instruments, eq(instruments.id, userPriceAlerts.instrumentId))
      .innerJoin(authUser, eq(authUser.id, userPriceAlerts.userId))
      .where(and(eq(userPriceAlerts.status, "attivo"), eq(instruments.priceMode, "auto")));
    summary.checked = active.length;
    if (active.length === 0) return summary;

    const closes = new Map<string, { date: string; close: number } | null>();
    for (const id of new Set(active.map((a) => a.alert.instrumentId))) closes.set(id, await latestClose(id));

    for (const row of active) {
      const close = closes.get(row.alert.instrumentId);
      if (!close || !isAlertTriggered(row.alert.direction, Number(row.alert.targetPrice), close.close)) continue;
      const [claimed] = await db
        .update(userPriceAlerts)
        .set({ status: "scattato", triggeredAt: new Date(), triggeredPrice: String(close.close) })
        .where(and(eq(userPriceAlerts.id, row.alert.id), eq(userPriceAlerts.status, "attivo")))
        .returning({ id: userPriceAlerts.id });
      if (!claimed) continue;
      summary.triggered += 1;
      try {
        const ok = await send(
          row.email,
          alertEmailContent({
            instrumentName: row.instrumentName,
            currency: row.currency,
            direction: row.alert.direction,
            targetPrice: Number(row.alert.targetPrice),
            closePrice: close.close,
            closeDate: close.date,
            appUrl: getAppUrl(),
            instrumentId: row.alert.instrumentId,
          })
        );
        if (!ok) throw new Error("email non inviata");
      } catch (error) {
        summary.emailFailed += 1;
        // L'indirizzo non va nei log: solo l'utente in forma di hash.
        log.warn("market.alerts.email_failed", { user: hashUserId(row.alert.userId), error });
      }
    }
    log.info("market.alerts.evaluated", { total: summary.checked, processed: summary.triggered, count: summary.emailFailed });
  } catch (error) {
    log.warn("market.alerts.failed", { error });
  }
  return summary;
}
