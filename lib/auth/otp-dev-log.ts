import { logger, type Logger } from "@/lib/observability";

/** Event that carries the sign-in code in development. Never emitted in production. */
export const DEV_OTP_LOG_EVENT = "auth.otp.dev_code";

/** True when the sign-in code may be written to the logs: every environment except production. */
export function canLogDevOtp(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv !== "production";
}

/**
 * Writes the emailed sign-in code to the logs when the email can't be delivered in development (no Resend key, or a
 * failed send), so a developer can sign in from a simulator. Refuses in production: there the code only travels by
 * email. Returns whether the code was logged.
 */
export function logDevOtp(otp: string, options: { nodeEnv?: string; log?: Logger } = {}): boolean {
  if (!canLogDevOtp(options.nodeEnv ?? process.env.NODE_ENV)) return false;
  (options.log ?? logger).info(DEV_OTP_LOG_EVENT, { devCode: otp });
  return true;
}
