import "server-only";
import { Resend } from "resend";
import { redis } from "@/lib/redis/client";
import { REPORT_RATE_LIMIT, REPORT_RATE_WINDOW_SECONDS, SUPPORT_EMAIL } from "./constants";
import { reportEmailContent, type ReportInput } from "./report";

/** Conta la segnalazione dell'utente nella finestra e dice se ne ha ancora a disposizione. Se Redis non risponde lascia passare. */
export async function consumeReportQuota(userId: string): Promise<boolean> {
  const key = `support:report:${userId}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, REPORT_RATE_WINDOW_SECONDS);
    return count <= REPORT_RATE_LIMIT;
  } catch {
    return true;
  }
}

/** Invia la segnalazione alla casella di supporto con reply-to sull'utente. Ritorna false se Resend rifiuta (dettaglio non loggato: può contenere l'indirizzo). */
export async function sendSupportReport(params: {
  reference: string;
  input: ReportInput;
  userEmail: string;
  userAgent: string | null;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { subject, text } = reportEmailContent(params);
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) return { ok: false, reason: "email_not_configured" };
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: process.env.RESEND_FROM,
    to: process.env.SUPPORT_EMAIL_TO ?? SUPPORT_EMAIL,
    replyTo: params.userEmail,
    subject,
    text,
  });
  return error ? { ok: false, reason: error.name } : { ok: true };
}
