import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), "utf8")) as Record<string, string>;

describe("versioni del repo", () => {
  it("app, landing e manifest di release-please sono allineati", () => {
    const version = read("package.json").version;
    expect(read("landing/package.json").version).toBe(version);
    expect(read(".release-please-manifest.json")["."]).toBe(version);
  });
});
