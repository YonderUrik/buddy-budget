import { describe, expect, it } from "vitest";
import {
  PUBLIC_DEMO_BLOCKED_AUTH_PATHS,
  isPublicDemoEnabled,
  isPublicDemoUserId,
  isReadOnlyMethod,
  pickPublicDemoLanguage,
  publicDemoProfile,
  publicDemoUserId,
} from "./config";

describe("public demo config", () => {
  it("recognises demo ids only by their prefix", () => {
    expect(publicDemoUserId("en")).toBe("public-demo-en");
    expect(isPublicDemoUserId("public-demo-it")).toBe(true);
    expect(isPublicDemoUserId("demo-user")).toBe(false);
    expect(isPublicDemoUserId("Xk2l9")).toBe(false);
    expect(isPublicDemoUserId(undefined)).toBe(false);
  });

  it("shows the Italian rules in English and the German rules in German", () => {
    expect(publicDemoProfile("en")).toEqual({ productCountry: "IT", language: "en" });
    expect(publicDemoProfile("it")).toEqual({ productCountry: "IT", language: "it" });
    expect(publicDemoProfile("de")).toEqual({ productCountry: "DE", language: "de" });
  });

  it("is off unless explicitly enabled", () => {
    expect(isPublicDemoEnabled({})).toBe(false);
    expect(isPublicDemoEnabled({ PUBLIC_DEMO_ENABLED: "1" })).toBe(false);
    expect(isPublicDemoEnabled({ PUBLIC_DEMO_ENABLED: "true" })).toBe(true);
  });

  it("picks the language from the query, then Accept-Language, then English", () => {
    expect(pickPublicDemoLanguage("de", "it-IT")).toBe("de");
    expect(pickPublicDemoLanguage("fr", "it-IT,it;q=0.9")).toBe("it");
    expect(pickPublicDemoLanguage(null, "fr-FR,de;q=0.8,en;q=0.9")).toBe("en");
    expect(pickPublicDemoLanguage(null, "fr-FR,de;q=0.8")).toBe("de");
    expect(pickPublicDemoLanguage(null, "fr-FR")).toBe("en");
    expect(pickPublicDemoLanguage(null, null)).toBe("en");
    expect(pickPublicDemoLanguage(null, "it;q=0")).toBe("en");
  });

  it("allows reads and blocks account changes", () => {
    expect(isReadOnlyMethod("GET")).toBe(true);
    expect(isReadOnlyMethod("POST")).toBe(false);
    expect(isReadOnlyMethod("DELETE")).toBe(false);
    expect(PUBLIC_DEMO_BLOCKED_AUTH_PATHS.has("/delete-user")).toBe(true);
    expect(PUBLIC_DEMO_BLOCKED_AUTH_PATHS.has("/sign-out")).toBe(false);
  });
});
