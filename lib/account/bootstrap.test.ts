import { describe, expect, it } from "vitest";
import { LEGAL_VERSION } from "@/lib/legal";
import { buildMeBootstrap, meBootstrapSchema, type BootstrapSession } from "./bootstrap";

const createdAt = new Date("2026-10-18T08:00:00.000Z");
function sessionWith(user: Partial<BootstrapSession["user"]> = {}): BootstrapSession {
  return {
    user: {
      id: "user-1", name: "Mario", email: "mario@example.com", emailVerified: true, image: null,
      productCountry: "IT", language: "it", currency: "EUR", homePage: "/panoramica", hideAmounts: false,
      onboardingCompleted: true, deletionScheduledAt: null, legalAcceptedAt: createdAt, legalAcceptedVersion: LEGAL_VERSION,
      ...user,
    },
    session: { createdAt, expiresAt: new Date("2026-10-25T08:00:00.000Z") },
  };
}

describe("buildMeBootstrap", () => {
  it("returns a schema-valid launch state for an active Italian user", () => {
    const bootstrap = meBootstrapSchema.parse(buildMeBootstrap(sessionWith()));
    expect(bootstrap.gate).toBeNull();
    expect(bootstrap.profile).toEqual({ productCountry: "IT", language: "it", availableLanguages: ["it", "en"], currency: "EUR", homePage: "/panoramica", hideAmounts: false });
    expect(bootstrap.legal).toEqual({ currentVersion: LEGAL_VERSION, acceptedVersion: LEGAL_VERSION, acceptedAt: createdAt.toISOString(), needsAcceptance: false });
    expect(Object.values(bootstrap.capabilities.sections).every(Boolean)).toBe(true);
    expect(bootstrap.session.recentLoginUntil).toBe("2026-10-18T08:10:00.000Z");
    expect(bootstrap.account).toEqual({ deactivated: false, deletionScheduledAt: null, readOnlyDemo: false });
  });

  it("reports the gate the proxy applies", () => {
    expect(buildMeBootstrap(sessionWith({ deletionScheduledAt: new Date("2026-11-17T00:00:00.000Z") }))).toMatchObject({
      gate: "account_deactivated", account: { deactivated: true, deletionScheduledAt: "2026-11-17T00:00:00.000Z" },
    });
    expect(buildMeBootstrap(sessionWith({ legalAcceptedVersion: "2020-01-01" }))).toMatchObject({ gate: "legal_acceptance_required", legal: { needsAcceptance: true } });
    // New users accept the documents during onboarding, so onboarding is the gate even without an accepted version.
    expect(buildMeBootstrap(sessionWith({ onboardingCompleted: false, legalAcceptedVersion: null, legalAcceptedAt: null }))).toMatchObject({
      gate: "onboarding_required", onboarding: { completed: false }, legal: { needsAcceptance: true, acceptedAt: null },
    });
  });

  it("derives the German capability map from the shared country policy", () => {
    const { capabilities, profile } = buildMeBootstrap(sessionWith({ productCountry: "DE", language: "de" }));
    expect(profile.availableLanguages).toEqual(["en", "de"]);
    expect(capabilities.features).toEqual({ taxes: false, pension: false, retirement: true, incomeForecasts: false, inflation: true });
    expect(capabilities.sections).toEqual({
      pension: false, analytics: true, goals: true, investmentTaxes: true, investmentIncome: true, fire: true, financialPlanning: true,
    });
  });

  it("falls back to safe defaults for legacy or invalid stored values", () => {
    const { profile } = buildMeBootstrap(sessionWith({ productCountry: "FR", language: "fr", homePage: "/movimenti", currency: null }));
    expect(profile).toMatchObject({ productCountry: "IT", language: "it", homePage: "/liquidita", currency: "EUR" });
  });
});
