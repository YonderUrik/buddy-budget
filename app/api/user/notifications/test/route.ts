import { NextRequest } from "next/server";
import { and, eq, gte } from "drizzle-orm";
import { readJson, sessionOrUnauthorized } from "@/lib/account/route-session";
import { db } from "@/lib/db/client";
import { budgets } from "@/lib/db/schema/budgets";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { getAppUrl } from "@/lib/env";
import { formatCurrency } from "@/lib/format";
import { TEST_EMAIL_MAX_PER_HOUR } from "@/lib/notifications";
import {
  NOTIFICATION_SETTINGS_PATH,
  buildDigest,
  claimKeys,
  countRecentTests,
  createUnsubscribeToken,
  digestEmail,
  digestWindowStartIso,
  sendNotificationEmail,
  unsubscribePageUrl,
} from "@/lib/notifications/server";
import { recordNotificationEmail, requestLogger, withRoute } from "@/lib/observability";

/**
 * Manda a chi lo chiede un esempio del riepilogo con i suoi dati (ultimo mese concluso), così vede che cosa riceverà.
 * Va solo all'indirizzo dell'account, al massimo `TEST_EMAIL_MAX_PER_HOUR` volte all'ora, e porta il link di disiscrizione come le altre.
 */
async function handlePost(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  await readJson(request);
  const { user } = session;
  const now = new Date();
  const log = requestLogger();

  if ((await countRecentTests(user.id, now)) >= TEST_EMAIL_MAX_PER_HOUR) {
    recordNotificationEmail("test", "capped");
    return Response.json({ error: "Hai già chiesto alcuni esempi: riprova tra un po'." }, { status: 429 });
  }
  const [transactionRows, categoryRows, budgetRows] = await Promise.all([
    db.select().from(transactions).where(and(eq(transactions.userId, user.id), gte(transactions.date, digestWindowStartIso("mensile", now)))),
    db.select().from(categories).where(eq(categories.userId, user.id)),
    db.select().from(budgets).where(eq(budgets.userId, user.id)),
  ]);
  const data = buildDigest({ transactions: transactionRows, categories: categoryRows, budgets: budgetRows, frequency: "mensile", now });
  if (data.movements === 0) {
    return Response.json({ error: "Nel mese scorso non hai movimenti: l'esempio sarebbe vuoto." }, { status: 409 });
  }
  const appUrl = getAppUrl();
  const token = createUnsubscribeToken({ userId: user.id, scope: "digest" });
  const hidden = user.hideAmounts === true;
  const email = digestEmail(data, {
    appUrl,
    money: (value) => (hidden ? "••••" : formatCurrency(value, user.currency ?? "EUR")),
    unsubscribeUrl: unsubscribePageUrl(appUrl, token),
    preferencesUrl: `${appUrl}${NOTIFICATION_SETTINGS_PATH}`,
  });
  await claimKeys(user.id, "test", [crypto.randomUUID()], now);
  const ok = await sendNotificationEmail(user.email, { ...email, subject: `Esempio · ${email.subject}` }, { appUrl, unsubscribeToken: token }).catch(() => false);
  recordNotificationEmail("test", ok ? "sent" : "failed");
  if (!ok) {
    log.warn("notifications.email.failed", { kind: "test" });
    return Response.json({ error: "Non siamo riusciti a inviare l'email. Riprova tra poco." }, { status: 502 });
  }
  log.info("notifications.email.sent", { kind: "test" });
  return new Response(null, { status: 204 });
}

export const POST = withRoute("user.notifications.test", handlePost);
