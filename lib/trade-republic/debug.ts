import { AsyncLocalStorage } from "node:async_hooks";
import { logger, redactText } from "@/lib/observability";

/** Staging is the only deployment served from this host; production and self-hosted installs never match it. */
const DEBUG_HOSTNAME = "staging.buddybudget.io";
const MAX_SHAPE_DEPTH = 4;
const MAX_SHAPE_KEYS = 40;
/** Bounds of the diagnostic trail attached to a failure line (one Loki line, well under its size limit). */
const MAX_TRAIL_ENTRIES = 80;
const MAX_TRAIL_ENTRY_CHARS = 4000;

const trail = new AsyncLocalStorage<string[]>();

/** Run a login or sync step while collecting its diagnostic trail, so a failure can log the whole story. */
export function withTradeRepublicDiagnostics<T>(action: () => Promise<T>): Promise<T> {
  return trail.run([], action);
}

/** The trail collected so far by `withTradeRepublicDiagnostics`, as one JSON string for the `diagnostics` log field. */
export function tradeRepublicDiagnostics(): string {
  return JSON.stringify(trail.getStore() ?? []);
}

/** True only on staging: TR debug logs describe provider responses and must stay off in production. */
export function tradeRepublicDebugEnabled(): boolean {
  try { return new URL(process.env.APP_URL ?? "").hostname === DEBUG_HOSTNAME; }
  catch { return false; }
}

/**
 * Record a diagnostic step: kept in the current trail (logged everywhere, only when a login or sync fails) and,
 * on staging, logged live as `trade_republic.debug.<step>`. `trail: false` for high-volume steps (frames, pages)
 * that are summarised elsewhere. Callers pass structure, enums, counts and masked patterns only: never titles,
 * amounts, ids, IBANs, cookie values or names, phone numbers, PINs or codes.
 */
export function tradeRepublicDebug(step: string, details: Record<string, unknown> = {}, options: { trail?: boolean } = {}): void {
  let debug: string;
  try { debug = JSON.stringify(details); } catch { debug = "unserializable"; }
  const entries = options.trail === false ? undefined : trail.getStore();
  if (entries) {
    entries.push(`${step} ${debug}`.slice(0, MAX_TRAIL_ENTRY_CHARS));
    if (entries.length > MAX_TRAIL_ENTRIES) entries.splice(1, 1); // keep the first step, drop the oldest after it
  }
  if (tradeRepublicDebugEnabled()) logger.info(`trade_republic.debug.${step}`, { debug });
}

/** Type structure of a provider payload with every value removed (strings become their length only). */
export function describeShape(value: unknown, depth = 0): unknown {
  if (value === null) return "null";
  if (Array.isArray(value)) return value.length === 0 ? "array(0)" : [`array(${value.length})`, depth >= MAX_SHAPE_DEPTH ? "…" : describeShape(value[0], depth + 1)];
  if (typeof value === "object") {
    if (depth >= MAX_SHAPE_DEPTH) return "object";
    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_SHAPE_KEYS);
    return Object.fromEntries(entries.map(([key, child]) => [key, describeShape(child, depth + 1)]));
  }
  if (typeof value === "string") return `string(${value.length})`;
  return typeof value;
}

/** Format of a value with digits masked as 9 and letters other than T/Z as a, e.g. `9999-99-99T99:99:99.999+9999`. */
export function maskPattern(value: unknown): string {
  if (typeof value !== "string") return typeof value;
  return value.slice(0, 40).replace(/\d/g, "9").replace(/[A-SU-Ya-z]/g, "a");
}

/** Count occurrences of a categorical field (event type, status, timestamp pattern). */
export function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) { const value = key(item); counts[value] = (counts[value] ?? 0) + 1; }
  return counts;
}

/** Zod issues as path + code only: no input values. */
export function describeIssues(issues: { path: PropertyKey[]; code: string }[], limit = 20) {
  return issues.slice(0, limit).map(issue => `${issue.path.map(String).join(".")}:${issue.code}`);
}

/** Error class and redacted message for unexpected (non-Trade Republic) failures. */
export function describeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { type: typeof error };
  const cause = error.cause instanceof Error ? { name: error.cause.name, code: (error.cause as { code?: unknown }).code } : undefined;
  return { name: error.name, message: redactText(error.message).slice(0, 300), cause };
}
