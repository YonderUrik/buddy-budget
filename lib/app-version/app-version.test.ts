import { describe, expect, it } from "vitest";

import { formatVersionDetails, formatVersionLabel } from "./index";
import { resolveBuildInfo, resolveCommitSha } from "./resolve";

const SHA = "d14089a0123456789abcdef0123456789abcdef0";
const failingGit = () => {
  throw new Error("not a git repo");
};

describe("resolveCommitSha", () => {
  it("preferisce GIT_COMMIT_SHA (build-arg CI)", () => {
    expect(resolveCommitSha({ GIT_COMMIT_SHA: SHA, VERCEL_GIT_COMMIT_SHA: "other" }, failingGit)).toBe(SHA);
  });

  it("usa VERCEL_GIT_COMMIT_SHA se manca GIT_COMMIT_SHA", () => {
    expect(resolveCommitSha({ VERCEL_GIT_COMMIT_SHA: SHA }, failingGit)).toBe(SHA);
  });

  it("ignora valori vuoti e ripiega su git", () => {
    expect(resolveCommitSha({ GIT_COMMIT_SHA: "  " }, () => `${SHA}\n`)).toBe(SHA);
  });

  it("restituisce stringa vuota se git non è disponibile", () => {
    expect(resolveCommitSha({}, failingGit)).toBe("");
  });
});

describe("resolveBuildInfo", () => {
  it("combina versione, commit e istante di build", () => {
    const now = new Date("2026-09-27T10:00:00Z");
    expect(resolveBuildInfo("1.2.3", { GIT_COMMIT_SHA: SHA }, now)).toEqual({
      version: "1.2.3",
      commit: SHA,
      builtAt: "2026-09-27T10:00:00.000Z",
    });
  });
});

describe("formatVersionLabel", () => {
  it("mostra versione e SHA abbreviato", () => {
    expect(formatVersionLabel({ version: "0.1.0", commit: SHA, builtAt: "" })).toBe("v0.1.0 · d14089a");
  });

  it("mostra solo la versione senza commit", () => {
    expect(formatVersionLabel({ version: "0.1.0", commit: "", builtAt: "" })).toBe("v0.1.0");
  });
});

describe("formatVersionDetails", () => {
  it("include versione, commit e data di build", () => {
    const text = formatVersionDetails({ version: "0.1.0", commit: SHA, builtAt: "2026-09-27T10:00:00Z" });
    expect(text).toContain("Versione 0.1.0");
    expect(text).toContain("Commit d14089a");
    expect(text).toMatch(/Build \d/);
  });

  it("omette le righe con dati mancanti o non validi", () => {
    expect(formatVersionDetails({ version: "0.1.0", commit: "", builtAt: "boh" })).toBe("Versione 0.1.0");
  });
});
