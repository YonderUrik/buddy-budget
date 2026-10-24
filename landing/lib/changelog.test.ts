import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseChangelog, projectActivity, readChangelog } from "./changelog";

const SAMPLE = `# Changelog

## [0.86.1](https://github.com/o/r/compare/v0.86.0...v0.86.1) (2026-10-23)


### Correzioni

* let Google read the app's robots.txt ([#494](https://github.com/o/r/issues/494)) ([8d065c2](https://github.com/o/r/commit/8d065c2))

## [0.86.0](https://github.com/o/r/compare/v0.85.2...v0.86.0) (2026-10-22)


### Novità

* budget of the month with proposals ([#492](https://github.com/o/r/issues/492)) ([549119e](https://github.com/o/r/commit/549119e))
* **pensione:** import delle fotografie da CSV ([#95](https://github.com/o/r/issues/95)) ([689f1b8](https://github.com/o/r/commit/689f1b8))


### Correzioni

* **deps:** bump next to 16.4.1 ([#487](https://github.com/o/r/issues/487)) ([a40e879](https://github.com/o/r/commit/a40e879))


### Refactoring

* move helpers ([#480](https://github.com/o/r/issues/480)) ([aaaaaaa](https://github.com/o/r/commit/aaaaaaa))

## 0.2.0 — 2026-10-03

Prima versione numerata.
`;

describe("parseChangelog", () => {
  const releases = parseChangelog(SAMPLE);

  it("reads every release with its date, newest first", () => {
    expect(releases.map((r) => [r.version, r.date])).toEqual([
      ["0.86.1", "2026-10-23"],
      ["0.86.0", "2026-10-22"],
      ["0.2.0", "2026-10-03"],
    ]);
  });

  it("keeps features and fixes as plain lines, without links, scopes or dependency bumps", () => {
    expect(releases[0].changes).toEqual([{ kind: "fix", text: "Let Google read the app's robots.txt", pr: 494 }]);
    expect(releases[1].changes).toEqual([
      { kind: "feat", text: "Budget of the month with proposals", pr: 492 },
      { kind: "feat", text: "Import delle fotografie da CSV", pr: 95 },
    ]);
  });

  it("counts releases and changes, never users", () => {
    expect(projectActivity(releases)).toEqual({
      releases: 3,
      featureReleases: 1,
      changes: 3,
      firstDate: "2026-10-03",
      latest: { version: "0.86.1", date: "2026-10-23" },
    });
  });
});

describe("readChangelog", () => {
  it("reads the repository's CHANGELOG.md when it is there", () => {
    const root = join(process.cwd(), "..", "CHANGELOG.md");
    if (!existsSync(root)) return;
    const releases = readChangelog();
    expect(releases?.length).toBeGreaterThan(10);
    expect(releases?.[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
