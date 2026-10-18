/** Hosts a dev-only tool may write to: the developer's own machine (Docker Postgres published on localhost). */
export const LOCAL_DATABASE_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]"] as const;

/** Why a dev-only tool refuses to run, or `null` when it may. */
export type DevToolRefusal = "production" | "missing_database_url" | "invalid_database_url" | "non_local_database";

/**
 * Checks that a dev-only tool that writes users and sessions runs against a local database outside production.
 * Pure, so the guard itself is tested: `NODE_ENV=production` or any database host other than localhost refuses.
 */
export function devToolRefusal(env: { nodeEnv?: string; databaseUrl?: string }): DevToolRefusal | null {
  if (env.nodeEnv === "production") return "production";
  if (!env.databaseUrl) return "missing_database_url";
  let host: string;
  try {
    host = new URL(env.databaseUrl).hostname;
  } catch {
    return "invalid_database_url";
  }
  return (LOCAL_DATABASE_HOSTS as readonly string[]).includes(host) ? null : "non_local_database";
}

/**
 * Addresses the dev session script may wipe and re-seed with demo data: reserved test domains only
 * (`.test`, `example.com`/`.org`/`.net`), never a mailbox that could belong to a real person.
 */
export function isDisposableTestEmail(email: string): boolean {
  const domain = email.toLowerCase().split("@")[1] ?? "";
  return domain.endsWith(".test") || ["example.com", "example.org", "example.net"].includes(domain);
}
