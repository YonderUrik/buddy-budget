import "server-only";

import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";
import { emailFrom, emailTransport } from "./transport";

export { emailFrom, emailTransport, isEmailConfigured, type EmailTransport } from "./transport";

/** One outgoing email, the same for every transport. */
export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  /** Resend only: the same key within 24 hours is sent once (SMTP has no equivalent and ignores it). */
  idempotencyKey?: string;
}

/** Outcome of a send. `reason` is a short error type (never the provider's message, which can contain addresses). */
export type SendEmailResult = { ok: true } | { ok: false; reason: string };

let smtp: Transporter | null = null;

/** SMTP connection created on first use from `SMTP_URL` (e.g. `smtps://user:pass@smtp.example.com:465`). */
function smtpTransport(): Transporter {
  smtp ??= nodemailer.createTransport(process.env.SMTP_URL!.trim());
  return smtp;
}

/** Short, address-free error type of a nodemailer error (`EAUTH`, `ECONNECTION`, `EENVELOPE`...). */
function smtpReason(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[A-Z_]{2,32}$/.test(code) ? `smtp_${code}` : "smtp_failed";
}

/**
 * Sends one email with the configured transport. Never throws: a missing configuration gives
 * `email_not_configured`, a provider error its short type.
 */
export async function sendEmail(email: OutgoingEmail): Promise<SendEmailResult> {
  const transport = emailTransport();
  const from = emailFrom();
  if (!transport || !from) return { ok: false, reason: "email_not_configured" };
  const { to, subject, text, html, replyTo, headers, idempotencyKey } = email;
  if (transport === "resend") {
    try {
      const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send(
        { from, to, subject, text, ...(html ? { html } : {}), ...(replyTo ? { replyTo } : {}), ...(headers ? { headers } : {}) },
        idempotencyKey ? { idempotencyKey } : undefined,
      );
      return error ? { ok: false, reason: error.name } : { ok: true };
    } catch {
      return { ok: false, reason: "resend_failed" };
    }
  }
  try {
    await smtpTransport().sendMail({ from, to, subject, text, html, replyTo, headers });
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: smtpReason(error) };
  }
}
