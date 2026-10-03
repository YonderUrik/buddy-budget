/**
 * Prepara una release: alza la versione in package.json (app e landing) e aggiunge la sezione
 * al CHANGELOG con i titoli delle PR mergiate dall'ultimo tag. Non crea commit né tag: si apre
 * una PR "Release vX.Y.Z" e, al merge, la CI crea tag, GitHub Release e deploy (docs/rilasci.md).
 *
 * Uso: pnpm release:prepare <patch|minor|major|X.Y.Z> [--dry-run]
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { nextVersion, prependSection, renderChangelogSection } from "../lib/release";

const PACKAGE_FILES = ["package.json", "landing/package.json"];
const CHANGELOG = "CHANGELOG.md";

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function setVersion(file: string, version: string, dryRun: boolean) {
  const raw = readFileSync(file, "utf8");
  const updated = raw.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`);
  if (updated === raw) throw new Error(`Versione non trovata in ${file}`);
  if (!dryRun) writeFileSync(file, updated);
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const request = args.find((a) => !a.startsWith("--"));
  if (!request) throw new Error("Uso: pnpm release:prepare <patch|minor|major|X.Y.Z> [--dry-run]");

  const current = (JSON.parse(readFileSync("package.json", "utf8")) as { version: string }).version;
  const version = nextVersion(current, request);

  let lastTag = "";
  try {
    lastTag = git("describe", "--tags", "--abbrev=0", "--match", "v*");
  } catch {
    // Nessun tag: prima release.
  }
  const range = lastTag ? `${lastTag}..HEAD` : "HEAD";
  const subjects = git("log", range, "--first-parent", "--format=%s").split("\n").filter(Boolean);
  const section = renderChangelogSection(version, new Date().toISOString().slice(0, 10), subjects);

  console.log(`Versione ${current} → ${version} (dall'ultimo tag: ${lastTag || "nessuno"}, ${subjects.length} commit)\n`);
  console.log(section);
  if (dryRun) return;

  for (const file of PACKAGE_FILES) setVersion(file, version, dryRun);
  const previous = existsSync(CHANGELOG) ? readFileSync(CHANGELOG, "utf8") : null;
  writeFileSync(CHANGELOG, prependSection(previous, section));
  console.log(`Aggiornati ${[...PACKAGE_FILES, CHANGELOG].join(", ")}. Ora: branch release/v${version}, commit "Release v${version}" e PR.`);
}

main();
