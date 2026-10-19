import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("OpenRouter requests", () => {
  it("every file that calls OpenRouter sends OPENROUTER_PRIVACY (the privacy policy promises zero data retention)", () => {
    const callers = ["lib", "app", "scripts"]
      .flatMap((dir) => sourceFiles(join(ROOT, dir)))
      .filter((path) => readFileSync(path, "utf8").includes("openrouter.ai/api"));
    expect(callers.length).toBeGreaterThan(0);
    for (const path of callers) expect(readFileSync(path, "utf8"), path).toContain("OPENROUTER_PRIVACY");
  });
});
