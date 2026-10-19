import "server-only";
import { sendEmail } from "@/lib/email/send";
import { isSelfHosted } from "@/lib/instance/config";
import { redis } from "@/lib/redis/client";
import { REPORT_RATE_LIMIT, REPORT_RATE_WINDOW_SECONDS, SUPPORT_EMAIL } from "./constants";
import { reportEmailContent, type ReportInput } from "./report";

/**
 * Address the reports go to: `SUPPORT_EMAIL_TO`, else the project's support mailbox on the hosted version. A self-hosted
 * install without `SUPPORT_EMAIL_TO` sends nothing: its users' reports are for whoever runs it, not for the project.
 */
export function supportRecipient(): string | null {
  const configured = process.env.SUPPORT_EMAIL_TO?.trim();
  if (configured) return configured;
  return isSelfHosted() ? null : SUPPORT_EMAIL;
}

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
  const to = supportRecipient();
  if (!to) return { ok: false, reason: "support_not_configured" };
  return sendEmail({ to, replyTo: params.userEmail, subject, text });
}
