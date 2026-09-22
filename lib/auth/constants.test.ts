import { describe, expect, it } from "vitest";
import { DEFAULT_AFTER_LOGIN_PATH, safeRedirectPath } from "./constants";

describe("safeRedirectPath", () => {
  it("accetta un percorso interno", () => {
    expect(safeRedirectPath("/conti")).toBe("/conti");
    expect(safeRedirectPath("/transazioni?vista=analisi")).toBe("/transazioni?vista=analisi");
  });

  it("ripiega sul default per valori assenti o vuoti", () => {
    expect(safeRedirectPath(null)).toBe(DEFAULT_AFTER_LOGIN_PATH);
    expect(safeRedirectPath(undefined)).toBe(DEFAULT_AFTER_LOGIN_PATH);
    expect(safeRedirectPath("")).toBe(DEFAULT_AFTER_LOGIN_PATH);
  });

  it("rifiuta URL esterni e protocol-relative (open redirect)", () => {
    expect(safeRedirectPath("https://evil.example")).toBe(DEFAULT_AFTER_LOGIN_PATH);
    expect(safeRedirectPath("//evil.example")).toBe(DEFAULT_AFTER_LOGIN_PATH);
    expect(safeRedirectPath("/\\evil.example")).toBe(DEFAULT_AFTER_LOGIN_PATH);
  });

  it("non rimanda a login/onboarding o alla root", () => {
    expect(safeRedirectPath("/")).toBe(DEFAULT_AFTER_LOGIN_PATH);
    expect(safeRedirectPath("/login")).toBe(DEFAULT_AFTER_LOGIN_PATH);
    expect(safeRedirectPath("/onboarding")).toBe(DEFAULT_AFTER_LOGIN_PATH);
  });
});
