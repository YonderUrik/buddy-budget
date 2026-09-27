import { execSync } from "node:child_process";

/** Informazioni di build iniettate nel bundle da `next.config.ts`. */
export interface BuildInfo {
  /** Versione semver da package.json (es. "0.1.0"). */
  version: string;
  /** SHA completo del commit buildato, o stringa vuota se non determinabile. */
  commit: string;
  /** Istante della build in ISO 8601. */
  builtAt: string;
}

type Env = Record<string, string | undefined>;

/**
 * Determina lo SHA del commit buildato. Ordine: `GIT_COMMIT_SHA` (build-arg Docker dalla CI),
 * `VERCEL_GIT_COMMIT_SHA` (fornita da Vercel), poi `git rev-parse` locale. Nell'immagine Docker
 * `.git` è escluso, quindi senza build-arg il commit resta vuoto invece di far fallire la build.
 */
export function resolveCommitSha(env: Env, gitRevParse: () => string = readGitHead): string {
  const fromEnv = env.GIT_COMMIT_SHA?.trim() || env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (fromEnv) return fromEnv;
  try {
    return gitRevParse().trim();
  } catch {
    return "";
  }
}

function readGitHead(): string {
  return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString();
}

/** Raccoglie versione/commit/istante di build. Chiamata una volta sola, a build time. */
export function resolveBuildInfo(version: string, env: Env = process.env, now = new Date()): BuildInfo {
  return { version, commit: resolveCommitSha(env), builtAt: now.toISOString() };
}
