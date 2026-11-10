import "server-only";
import { createHash } from "node:crypto";
import { APP_BUILD_INFO } from "@/lib/app-version";
import { sendEmail } from "@/lib/email/send";
import { hashUserId, logger } from "@/lib/observability";
import { redis } from "@/lib/redis/client";
import { supportRecipient } from "@/lib/support/send";

/** Which part of the Trade Republic connection needs a parser or adapter change. */
export type TradeRepublicSupportArea = "login" | "sync" | "investments" | "unrecognized";

/** Reasons that point at our adapter, not at the user or a passing outage (wrong PIN, expiry, rate limit, network). */
const PARSER_REASONS = new Set(["invalid-response", "unsupported-event", "internal"]);
/** One email per distinct problem per day: a broken parser fails on every sync of every user. */
const DEDUP_SECONDS = 24 * 60 * 60;

const AREA_LABELS: Record<TradeRepublicSupportArea, string> = {
  login: "Accesso a Trade Republic",
  sync: "Importazione dei movimenti",
  investments: "Importazione degli investimenti",
  unrecognized: "Movimenti saltati perché non riconosciuti",
};

function trailSteps(diagnostics: string): string[] {
  try { const steps: unknown = JSON.parse(diagnostics); return Array.isArray(steps) ? steps.map(String) : [diagnostics]; }
  catch { return [diagnostics]; }
}

/** Problem identity: the area, the reason and the failed checks / finding keys, never values or user data. */
export function tradeRepublicProblemSignature(area: TradeRepublicSupportArea, reason: string, diagnostics: string): string {
  const checks = trailSteps(diagnostics).flatMap((step) => [...step.matchAll(/"(?:check|key)":"((?:[^"\\]|\\.)*)"/g)].map((match) => match[1]));
  return createHash("sha256").update(JSON.stringify([area, reason, [...new Set(checks)].sort()])).digest("hex").slice(0, 32);
}

/** Support email body: diagnostics already hold only structure, enums, counts and masked formats. */
export function tradeRepublicSupportEmail(area: TradeRepublicSupportArea, reason: string, diagnostics: string, userHash: string) {
  const steps = trailSteps(diagnostics);
  return {
    subject: `Trade Republic: ${AREA_LABELS[area].toLowerCase()} da sistemare (${reason})`,
    text: [
      `Area: ${AREA_LABELS[area]}`,
      `Motivo: ${reason}`,
      `Versione: ${APP_BUILD_INFO.version}${APP_BUILD_INFO.commit ? ` (${APP_BUILD_INFO.commit.slice(0, 8)})` : ""}`,
      `Utente (hash, come nei log): ${userHash}`,
      "",
      "Passaggi registrati (struttura e conteggi, nessun valore):",
      ...steps.map((step) => `- ${step}`),
      "",
      `Loki: {service="buddy-budget"} |= "trade_republic." |= "${userHash}"`,
      "Questa email parte una volta al giorno per lo stesso problema.",
    ].join("\n"),
  };
}

/**
 * Email the project when the Trade Republic adapter meets data it cannot handle, with the diagnostic trail, so the
 * parser gets fixed without waiting for a user report. Skips user-side outcomes, deduplicates per problem per day,
 * and never throws: a delivery failure must not touch the sync. Self-hosted installs without `SUPPORT_EMAIL_TO` send nothing.
 */
export async function notifyTradeRepublicSupport(area: TradeRepublicSupportArea, reason: string, diagnostics: string, userId: string): Promise<void> {
  if (area !== "unrecognized" && !PARSER_REASONS.has(reason)) return;
  const to = supportRecipient();
  if (!to) return;
  const key = tradeRepublicProblemSignature(area, reason, diagnostics);
  const lock = `trade-republic:support:${key}`;
  try {
    if (!await redis.set(lock, "1", "EX", DEDUP_SECONDS, "NX")) return;
    const result = await sendEmail({ to, ...tradeRepublicSupportEmail(area, reason, diagnostics, hashUserId(userId)), idempotencyKey: `trade-republic-support-${key}-${new Date().toISOString().slice(0, 10)}` });
    if (!result.ok) throw new Error("delivery failed");
    logger.info("trade_republic.support.sent", { phase: area, reason });
  } catch {
    // Free the daily slot so the next failure retries the email.
    await redis.del(lock).catch(() => {});
    logger.warn("trade_republic.support.failed", { phase: area, reason: "delivery_failed" });
  }
}
