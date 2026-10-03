/** Tipo di incremento semver richiesto da `pnpm release:prepare`. */
export type BumpKind = "patch" | "minor" | "major";

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/** `true` se la stringa è un semver `X.Y.Z` senza prefisso `v` né suffissi. */
export function isSemver(value: string): boolean {
  return SEMVER.test(value);
}

function parts(version: string): [number, number, number] {
  const m = SEMVER.exec(version);
  if (!m) throw new Error(`Versione non valida: "${version}" (atteso X.Y.Z)`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/**
 * Calcola la prossima versione. `request` è `patch|minor|major` oppure una versione esplicita
 * `X.Y.Z` (che deve essere maggiore della corrente).
 */
export function nextVersion(current: string, request: string): string {
  const [major, minor, patch] = parts(current);
  if (request === "patch") return `${major}.${minor}.${patch + 1}`;
  if (request === "minor") return `${major}.${minor + 1}.0`;
  if (request === "major") return `${major + 1}.0.0`;
  const [a, b, c] = parts(request);
  if (a < major || (a === major && (b < minor || (b === minor && c <= patch)))) {
    throw new Error(`La versione ${request} non è maggiore di ${current}`);
  }
  return request;
}
