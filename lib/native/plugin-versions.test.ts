import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Native plugins live in both projects: the web app imports their JS, the shell in `mobile/` ships their native code. */
const NATIVE_PACKAGE = /^@(capacitor|capgo)\//;

function nativeDependencies(file: string): Record<string, string> {
  const json = JSON.parse(readFileSync(path.join(process.cwd(), file), "utf8")) as { dependencies?: Record<string, string> };
  return Object.fromEntries(Object.entries(json.dependencies ?? {}).filter(([name]) => NATIVE_PACKAGE.test(name)));
}

describe("native plugin versions", () => {
  it("are pinned to the same exact version in the web app and in the native shell", () => {
    const web = nativeDependencies("package.json");
    const shell = nativeDependencies("mobile/package.json");
    // Platform packages exist only in the shell; every plugin the web app imports must be in the shell too.
    for (const [name, version] of Object.entries(web)) {
      expect(version, name).toMatch(/^\d+\.\d+\.\d+$/);
      expect(shell[name], `${name} must be in mobile/package.json`).toBe(version);
    }
    for (const [name, version] of Object.entries(shell)) {
      expect(version, name).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });
});
