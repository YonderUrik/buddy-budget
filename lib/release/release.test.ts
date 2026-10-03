import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractSection, groupSubjects, nextVersion, prependSection, renderChangelogSection } from "./index";

describe("nextVersion", () => {
  it("incrementa patch, minor e major", () => {
    expect(nextVersion("0.2.0", "patch")).toBe("0.2.1");
    expect(nextVersion("0.2.1", "minor")).toBe("0.3.0");
    expect(nextVersion("0.3.4", "major")).toBe("1.0.0");
  });
  it("accetta una versione esplicita solo se maggiore", () => {
    expect(nextVersion("0.2.0", "0.5.0")).toBe("0.5.0");
    expect(() => nextVersion("0.2.0", "0.2.0")).toThrow();
    expect(() => nextVersion("0.2.0", "0.1.9")).toThrow();
    expect(() => nextVersion("0.2.0", "v0.3.0")).toThrow();
  });
});

describe("changelog", () => {
  const subjects = ["Landing: nuova home (#94)", "chore(deps): bump motion (#89)", "Merge branch 'x'", "Release v0.2.0 (#1)"];

  it("separa modifiche e dipendenze e scarta merge e release", () => {
    expect(groupSubjects(subjects)).toEqual({
      changes: ["Landing: nuova home (#94)"],
      dependencies: ["chore(deps): bump motion (#89)"],
    });
  });

  it("mette le voci nuove in cima e permette di estrarre una sezione", () => {
    const first = prependSection(null, renderChangelogSection("0.2.0", "2026-10-03", [], "Punto di partenza."));
    const second = prependSection(first, renderChangelogSection("0.2.1", "2026-10-10", ["Fix (#1)"]));
    expect(second.indexOf("## 0.2.1")).toBeLessThan(second.indexOf("## 0.2.0"));
    expect(extractSection(second, "0.2.1")).toContain("- Fix (#1)");
    expect(extractSection(second, "0.2.1")).not.toContain("Punto di partenza");
    expect(extractSection(second, "0.2.0")).toBe("Punto di partenza.");
    expect(extractSection(second, "9.9.9")).toBeNull();
  });
});

describe("coerenza dei file di release", () => {
  const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  const version = (JSON.parse(read("package.json")) as { version: string }).version;

  it("app e landing hanno la stessa versione", () => {
    expect((JSON.parse(read("landing/package.json")) as { version: string }).version).toBe(version);
  });

  it("il CHANGELOG ha la sezione della versione corrente", () => {
    expect(extractSection(read("CHANGELOG.md"), version)).not.toBeNull();
  });
});
