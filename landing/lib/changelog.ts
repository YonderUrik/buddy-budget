/**
 * The project's dated history, read at build time from the repository's `CHANGELOG.md` (kept by release-please, one
 * section per release). It feeds the `/changelog` page and the «what you can count» block of the home: real dates
 * and counts of shipped releases, never of users. The landing image is built at every release, so the history is as
 * fresh as the site. Without the file (a copy built from `landing/` alone) everything that uses it hides.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Kind of a changelog line, from the release-please section it sits in. */
export type ChangeKind = "feat" | "fix" | "perf";

export interface ChangeLine {
  kind: ChangeKind;
  /** One line, as written in the pull request title (Markdown links and the area prefix removed). */
  text: string;
  /** The pull request that shipped it, when the line names one. */
  pr?: number;
}

export interface Release {
  version: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  changes: readonly ChangeLine[];
}

/** Section titles of `release-please-config.json` → kind. Refactoring and the hidden sections are not shown. */
const SECTION_KIND: Record<string, ChangeKind> = { "Novità": "feat", Correzioni: "fix", Prestazioni: "perf" };

/** Scopes left out of the public history: dependency bumps say nothing to a visitor. */
const HIDDEN_SCOPES = new Set(["deps"]);

const HEADING = /^## \[?(\d+\.\d+\.\d+)\]?(?:\([^)]*\))?\s*(?:\((\d{4}-\d{2}-\d{2})\)|—\s*(\d{4}-\d{2}-\d{2}))/;
const SCOPE = /^\*\*([^*:]+):\*\*\s*/;
const PR = /\(\[#(\d+)\]\([^)]*\)\)/;

/** Parses the text of `CHANGELOG.md` into releases, newest first, as in the file. */
export function parseChangelog(markdown: string): Release[] {
  const releases: { version: string; date: string; changes: ChangeLine[] }[] = [];
  let kind: ChangeKind | null = null;
  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    const heading = HEADING.exec(line);
    if (heading) {
      releases.push({ version: heading[1], date: heading[2] ?? heading[3], changes: [] });
      kind = null;
      continue;
    }
    if (line.startsWith("### ")) {
      kind = SECTION_KIND[line.slice(4).trim()] ?? null;
      continue;
    }
    const current = releases.at(-1);
    if (!current || !kind || !line.startsWith("* ")) continue;
    let text = line.slice(2);
    const scope = SCOPE.exec(text);
    if (scope && HIDDEN_SCOPES.has(scope[1].trim())) continue;
    if (scope) text = text.slice(scope[0].length);
    const pr = PR.exec(text);
    // Drop the PR and commit links release-please appends: «text ([#12](…)) ([abc1234](…))».
    text = text.replace(/\s*\(\[[^\]]+\]\([^)]*\)\)/g, "").trim();
    if (!text) continue;
    current.changes.push({ kind, text: text.charAt(0).toUpperCase() + text.slice(1), ...(pr ? { pr: Number(pr[1]) } : {}) });
  }
  return releases;
}

/** Where `CHANGELOG.md` can be at build time: copied next to the landing (image build) or at the repository root. */
const CANDIDATES = [join(process.cwd(), "CHANGELOG.md"), join(process.cwd(), "..", "CHANGELOG.md")];

/** Releases of the project, newest first; `null` when the build has no `CHANGELOG.md`. */
export function readChangelog(): Release[] | null {
  const file = CANDIDATES.find((path) => existsSync(path));
  if (!file) return null;
  const releases = parseChangelog(readFileSync(file, "utf8"));
  return releases.length > 0 ? releases : null;
}

export interface ProjectActivity {
  /** Numbered releases published. */
  releases: number;
  /** Releases that brought at least one new feature. */
  featureReleases: number;
  /** Lines of the public history (features, fixes, speed-ups). */
  changes: number;
  /** Date of the first numbered release. */
  firstDate: string;
  /** The newest release. */
  latest: { version: string; date: string };
}

/** The counts the home shows, all derived from the releases (none of them about users). */
export function projectActivity(releases: readonly Release[]): ProjectActivity {
  const newest = releases[0];
  return {
    releases: releases.length,
    featureReleases: releases.filter((r) => r.changes.some((c) => c.kind === "feat")).length,
    changes: releases.reduce((sum, r) => sum + r.changes.length, 0),
    firstDate: releases.at(-1)!.date,
    latest: { version: newest.version, date: newest.date },
  };
}
