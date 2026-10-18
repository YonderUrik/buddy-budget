/** Which transport sends the emails: Resend (hosted version) or any SMTP server (self-hosting). */
export type EmailTransport = "resend" | "smtp";

type Env = Record<string, string | undefined>;

/** Sender address: `EMAIL_FROM`, or `RESEND_FROM` (the older name, still read). */
export function emailFrom(env: Env = process.env): string | undefined {
  return env.EMAIL_FROM?.trim() || env.RESEND_FROM?.trim() || undefined;
}

/** The configured transport, or `null` when the instance cannot send emails. Resend wins when both are set. */
export function emailTransport(env: Env = process.env): EmailTransport | null {
  if (!emailFrom(env)) return null;
  if (env.RESEND_API_KEY?.trim()) return "resend";
  if (env.SMTP_URL?.trim()) return "smtp";
  return null;
}

/** True when the instance can send emails (sign-in links, password resets, alerts, summaries). */
export function isEmailConfigured(env: Env = process.env): boolean {
  return emailTransport(env) !== null;
}
